import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  DataClassification,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import type { SubmissionEntity } from './entities/submission.entity';

const SERVICE_NAME = 'collecte-service';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);
  private readonly ajv: Ajv;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async submit(
    dto: CreateSubmissionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    // 1. Load campaign and verify access
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    if (campaign.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Campaign ${dto.campaignId} is not active (status: ${campaign.status})`,
      );
    }

    // Tenant isolation
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      campaign.tenantId !== user.tenantId
    ) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    // 2. Validate against form template JSON Schema
    const schemaErrors = await this.validateAgainstTemplate(
      campaign.templateId,
      dto.data,
    );
    if (schemaErrors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Submission data does not match template schema',
        errors: schemaErrors.map((e) => ({
          field: e.instancePath || '/',
          message: e.message ?? 'Validation error',
        })),
      });
    }

    // 3. Persist submission
    const submission = await this.prisma.submission.create({
      data: {
        tenantId: user.tenantId,
        campaignId: dto.campaignId,
        templateId: campaign.templateId,
        data: dto.data as Prisma.InputJsonValue,
        submittedBy: user.userId,
        submittedAt: new Date(),
        deviceId: dto.deviceId ?? null,
        gpsLat: dto.gpsLat ?? null,
        gpsLng: dto.gpsLng ?? null,
        gpsAccuracy: dto.gpsAccuracy ?? null,
        offlineCreatedAt: dto.offlineCreatedAt
          ? new Date(dto.offlineCreatedAt)
          : null,
        dataClassification:
          dto.dataClassification ?? DataClassification.RESTRICTED,
        status: 'SUBMITTED',
      },
    });

    // 4. Request quality validation (async — fire and forget via Kafka)
    //    In production, data-quality service listens to the submitted event
    //    and runs quality gates, then publishes result back.
    this.logger.log(
      `Submission ${submission.id}: quality validation will be triggered via Kafka event`,
    );

    // 5. Create workflow instance (placeholder — workflow service not yet deployed)
    //    In production, workflow service listens to the submitted event
    //    and creates a WorkflowInstance starting at Level 1.
    this.logger.log(
      `Submission ${submission.id}: workflow instance will be created via Kafka event`,
    );

    // 6. Publish Kafka event
    await this.publishSubmittedEvent(submission, user);

    this.logger.log(
      `Submission created: ${submission.id} for campaign ${dto.campaignId}`,
    );

    return { data: submission as unknown as SubmissionEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & {
      campaignId?: string;
      status?: string;
      agent?: string;
    },
  ): Promise<PaginatedResponse<SubmissionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildFilter(user, query);

    const [data, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      data: data as unknown as SubmissionEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    // Tenant isolation
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      submission.tenantId !== user.tenantId
    ) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return { data: submission as unknown as SubmissionEntity };
  }

  /**
   * Validate submission data against the form template's JSON Schema.
   * Returns an empty array if validation passes, or a list of errors.
   */
  async validateAgainstTemplate(
    templateId: string,
    data: Record<string, unknown>,
  ): Promise<{ instancePath: string; message?: string }[]> {
    // Load the template from form-builder (via Prisma shared DB or HTTP)
    // In production this would call the form-builder service.
    // For now, we load from the FormTemplate table directly (shared DB pattern).
    try {
      const template = await this.prisma.formTemplate.findUnique({
        where: { id: templateId },
        select: { schema: true },
      });

      if (!template) {
        this.logger.warn(
          `Template ${templateId} not found — skipping schema validation`,
        );
        return [];
      }

      const schema = template.schema as Record<string, unknown>;
      const validate = this.ajv.compile(schema);
      const valid = validate(data);

      if (!valid && validate.errors) {
        return validate.errors.map((e) => ({
          instancePath: e.instancePath ?? '',
          message: e.message,
        }));
      }
    } catch (error) {
      // If form-builder table is not accessible, skip validation gracefully
      this.logger.warn(
        `Template schema validation skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return [];
  }

  private buildFilter(
    user: AuthenticatedUser,
    query: { campaignId?: string; status?: string; agent?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }

    if (query.campaignId) where['campaignId'] = query.campaignId;
    if (query.status) where['status'] = query.status;
    if (query.agent) where['submittedBy'] = query.agent;

    return where;
  }

  private async publishSubmittedEvent(
    submission: unknown,
    user: AuthenticatedUser,
  ): Promise<void> {
    const s = submission as SubmissionEntity;
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const payload = {
      submissionId: s.id,
      campaignId: s.campaignId,
      templateId: s.templateId,
      submittedBy: s.submittedBy,
      submittedAt: s.submittedAt,
      deviceId: s.deviceId,
      domain: undefined as string | undefined,
    };

    // Load campaign domain for the event
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: s.campaignId },
        select: { domain: true },
      });
      payload.domain = campaign?.domain;
    } catch {
      // Best effort
    }

    try {
      await this.kafkaProducer.send(
        TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        s.id,
        payload,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish submission event for ${s.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
