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
  TOPIC_AU_QUALITY_RECORD_REJECTED,
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
import { DataQualityClient } from '@aris/service-clients';
import { WorkflowClient } from '@aris/service-clients';
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
    private readonly dataQualityClient: DataQualityClient,
    private readonly workflowClient: WorkflowClient,
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

    // 4. Request quality validation via data-quality service
    const qualityResult = await this.requestQualityValidation(
      submission,
      campaign.domain ?? 'collecte',
      user,
    );

    // 5. Based on quality result, create workflow or reject
    if (qualityResult.passed) {
      await this.createWorkflowInstance(
        submission,
        campaign.domain ?? 'collecte',
        qualityResult.reportId,
        user,
      );
    }

    // 6. Publish Kafka event
    await this.publishSubmittedEvent(submission, user);

    this.logger.log(
      `Submission created: ${submission.id} for campaign ${dto.campaignId} (quality: ${qualityResult.passed ? 'PASSED' : 'FAILED'})`,
    );

    // Reload to get updated fields (qualityReportId, workflowInstanceId, status)
    const updated = await this.prisma.submission.findUnique({
      where: { id: submission.id },
    });

    return { data: (updated ?? submission) as unknown as SubmissionEntity };
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

  /**
   * Call data-quality service to validate the submission record.
   * On PASSED: stores qualityReportId, updates status to VALIDATED.
   * On FAILED: stores qualityReportId, updates status to REJECTED, publishes rejection event.
   */
  async requestQualityValidation(
    submission: { id: string; data: unknown; templateId: string },
    domain: string,
    user: AuthenticatedUser,
  ): Promise<{ passed: boolean; reportId: string | null }> {
    try {
      const response = await this.dataQualityClient.validate(
        {
          recordId: submission.id,
          entityType: 'Submission',
          domain,
          record: submission.data as Record<string, unknown>,
        },
        user.tenantId,
      );

      const report = response.data.data;
      const passed = report.overallStatus === 'PASSED' || report.overallStatus === 'WARNING';

      // Update submission with quality result
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          qualityReportId: report.id,
          status: passed ? 'VALIDATED' : 'REJECTED',
        },
      });

      if (!passed) {
        this.logger.warn(
          `Submission ${submission.id} rejected by quality gates: ${report.overallStatus}`,
        );
        await this.publishRejectionEvent(submission.id, report.id, user);
      } else {
        this.logger.log(`Submission ${submission.id} passed quality gates`);
      }

      return { passed, reportId: report.id };
    } catch (error) {
      // Quality service unavailable — log and proceed (graceful degradation)
      this.logger.warn(
        `Quality validation unavailable for submission ${submission.id}: ${error instanceof Error ? error.message : String(error)}. Proceeding with workflow creation.`,
      );
      return { passed: true, reportId: null };
    }
  }

  /**
   * Create a workflow instance for a validated submission.
   */
  private async createWorkflowInstance(
    submission: { id: string },
    domain: string,
    qualityReportId: string | null,
    user: AuthenticatedUser,
  ): Promise<void> {
    try {
      const response = await this.workflowClient.createInstance(
        {
          entityType: 'Submission',
          entityId: submission.id,
          domain,
          qualityReportId: qualityReportId ?? undefined,
        },
        user.tenantId,
      );

      const instance = response.data.data;

      // Store workflow instance ID on the submission
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: { workflowInstanceId: instance.id },
      });

      this.logger.log(
        `Workflow instance ${instance.id} created for submission ${submission.id}`,
      );
    } catch (error) {
      // Workflow service unavailable — log but don't fail the submission
      this.logger.warn(
        `Workflow creation failed for submission ${submission.id}: ${error instanceof Error ? error.message : String(error)}. Will retry via Kafka event.`,
      );
    }
  }

  /**
   * Publish a rejection notification event to Kafka.
   */
  private async publishRejectionEvent(
    submissionId: string,
    reportId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(
        TOPIC_AU_QUALITY_RECORD_REJECTED,
        submissionId,
        {
          submissionId,
          reportId,
          entityType: 'Submission',
          overallStatus: 'FAILED',
        },
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish rejection event for submission ${submissionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
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
