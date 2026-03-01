import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { FastifyKafka } from '@aris/kafka-client';
import {
  EVENTS,
} from '@aris/kafka-client';
import type {
  QualityValidationRequestedEvent,
  WorkflowInstanceRequestedEvent,
  QualityRecordValidatedEvent,
  QualityRecordRejectedEvent,
  WorkflowInstanceCreatedEvent,
} from '@aris/kafka-client';
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
import type { SubmissionEntity } from '../submission/entities/submission.entity';

const SERVICE_NAME = 'collecte-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class SubmissionService {
  private readonly ajv: Ajv;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
    private readonly kafka: FastifyKafka | null,
  ) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async submit(
    dto: {
      campaignId: string;
      data: Record<string, unknown>;
      deviceId?: string;
      gpsLat?: number;
      gpsLng?: number;
      gpsAccuracy?: number;
      offlineCreatedAt?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    // 1. Load campaign and verify access
    const campaign = await (this.prisma as any).campaign.findUnique({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
    }

    if (campaign.status !== 'ACTIVE') {
      throw new HttpError(
        400,
        `Campaign ${dto.campaignId} is not active (status: ${campaign.status})`,
      );
    }

    // Tenant isolation
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      campaign.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
    }

    // 2. Validate against form template JSON Schema
    const schemaErrors = await this.validateAgainstTemplate(
      campaign.templateId,
      dto.data,
    );
    if (schemaErrors.length > 0) {
      throw new HttpError(400, JSON.stringify({
        statusCode: 400,
        message: 'Submission data does not match template schema',
        errors: schemaErrors.map((e) => ({
          field: e.instancePath || '/',
          message: e.message ?? 'Validation error',
        })),
      }));
    }

    // 3. Persist submission
    const submission = await (this.prisma as any).submission.create({
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

    // 4. Request quality validation asynchronously via Kafka event
    await this.requestQualityValidation(
      submission,
      campaign.domain ?? 'collecte',
      user,
    );

    // 5. Publish submission event
    await this.publishSubmittedEvent(submission, user);

    console.log(
      `[SubmissionService] Submission created: ${submission.id} for campaign ${dto.campaignId} (quality validation requested via Kafka)`,
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
      (this.prisma as any).submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      (this.prisma as any).submission.count({ where }),
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
    const submission = await (this.prisma as any).submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Tenant isolation
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      submission.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Submission ${id} not found`);
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
    try {
      const template = await (this.prisma as any).formTemplate.findUnique({
        where: { id: templateId },
        select: { schema: true },
      });

      if (!template) {
        console.warn(
          `[SubmissionService] Template ${templateId} not found — skipping schema validation`,
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
      console.warn(
        `[SubmissionService] Template schema validation skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return [];
  }

  /**
   * Request quality validation asynchronously by publishing a Kafka event.
   * The data-quality service consumes this event, runs quality gates, and
   * publishes QUALITY.RECORD_VALIDATED or QUALITY.RECORD_REJECTED.
   */
  async requestQualityValidation(
    submission: { id: string; data: unknown; templateId: string },
    domain: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!this.kafka) return;

    try {
      const event: Omit<QualityValidationRequestedEvent, 'eventId' | 'timestamp'> = {
        eventType: EVENTS.QUALITY.VALIDATION_REQUESTED,
        source: SERVICE_NAME,
        version: 1,
        tenantId: user.tenantId,
        userId: user.userId,
        payload: {
          recordId: submission.id,
          entityType: 'Submission',
          domain,
          record: submission.data as Record<string, unknown>,
        },
      };

      await this.kafka.publish(event as any);
      console.log(
        `[SubmissionService] Quality validation requested for submission ${submission.id} via Kafka`,
      );
    } catch (error) {
      console.error(
        `[SubmissionService] Failed to publish quality validation request for ${submission.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Request workflow instance creation asynchronously by publishing a Kafka event.
   * Called when quality validation passes.
   */
  async requestWorkflowCreation(
    submissionId: string,
    domain: string,
    qualityReportId: string | null,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    if (!this.kafka) return;

    try {
      const event: Omit<WorkflowInstanceRequestedEvent, 'eventId' | 'timestamp'> = {
        eventType: EVENTS.WORKFLOW.INSTANCE_REQUESTED,
        source: SERVICE_NAME,
        version: 1,
        tenantId,
        userId,
        payload: {
          entityType: 'Submission',
          entityId: submissionId,
          domain,
          qualityReportId: qualityReportId ?? undefined,
        },
      };

      await this.kafka.publish(event as any);
      console.log(
        `[SubmissionService] Workflow creation requested for submission ${submissionId} via Kafka`,
      );
    } catch (error) {
      console.error(
        `[SubmissionService] Failed to publish workflow creation request for ${submissionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Handle quality validation result from data-quality service (via Kafka).
   * Updates submission status and triggers workflow creation if quality passed.
   */
  async handleQualityResult(
    submissionId: string,
    reportId: string,
    overallStatus: string,
    domain: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const passed = overallStatus === 'PASSED' || overallStatus === 'WARNING';

    await (this.prisma as any).submission.update({
      where: { id: submissionId },
      data: {
        qualityReportId: reportId,
        status: passed ? 'VALIDATED' : 'REJECTED',
      },
    });

    if (passed) {
      console.log(`[SubmissionService] Submission ${submissionId} passed quality gates`);
      await this.requestWorkflowCreation(submissionId, domain, reportId, tenantId, userId);
    } else {
      console.warn(
        `[SubmissionService] Submission ${submissionId} rejected by quality gates: ${overallStatus}`,
      );
    }
  }

  /**
   * Handle workflow instance created callback (via Kafka).
   * Updates submission with the workflow instance ID.
   */
  async handleWorkflowCreated(
    submissionId: string,
    workflowInstanceId: string,
  ): Promise<void> {
    await (this.prisma as any).submission.update({
      where: { id: submissionId },
      data: { workflowInstanceId },
    });
    console.log(
      `[SubmissionService] Workflow instance ${workflowInstanceId} linked to submission ${submissionId}`,
    );
  }

  /**
   * Set up Kafka consumers for quality and workflow events.
   * Called during app startup from app.ts.
   */
  async setupEventConsumers(): Promise<void> {
    if (!this.kafka) return;

    try {
      await this.kafka.subscribe(
        { topic: EVENTS.QUALITY.RECORD_VALIDATED, groupId: 'collecte-quality-validated-consumer' },
        async (payload) => {
          const event = payload as unknown as QualityRecordValidatedEvent;
          const { recordId, reportId, overallStatus, domain } = event.payload;
          console.log(
            `[CollecteEventConsumer] Quality VALIDATED for record ${recordId}: ${overallStatus}`,
          );
          await this.handleQualityResult(
            recordId,
            reportId,
            overallStatus,
            domain,
            event.tenantId ?? '',
            event.userId ?? '',
          );
        },
      );

      await this.kafka.subscribe(
        { topic: EVENTS.QUALITY.RECORD_REJECTED, groupId: 'collecte-quality-rejected-consumer' },
        async (payload) => {
          const event = payload as unknown as QualityRecordRejectedEvent;
          const { recordId, reportId, overallStatus, domain } = event.payload;
          console.log(
            `[CollecteEventConsumer] Quality REJECTED for record ${recordId}: ${overallStatus}`,
          );
          await this.handleQualityResult(
            recordId,
            reportId,
            overallStatus,
            domain,
            event.tenantId ?? '',
            event.userId ?? '',
          );
        },
      );

      await this.kafka.subscribe(
        { topic: EVENTS.WORKFLOW.INSTANCE_CREATED, groupId: 'collecte-workflow-created-consumer' },
        async (payload) => {
          const event = payload as unknown as WorkflowInstanceCreatedEvent;
          const { entityId, instanceId, entityType } = event.payload;

          // Only handle Submission entities
          if (entityType !== 'Submission') return;

          console.log(
            `[CollecteEventConsumer] Workflow instance ${instanceId} created for submission ${entityId}`,
          );
          await this.handleWorkflowCreated(entityId, instanceId);
        },
      );

      console.log(
        '[CollecteEventConsumer] Subscribed to quality validated/rejected and workflow created events',
      );
    } catch (error) {
      console.warn(
        `[CollecteEventConsumer] Kafka consumers not available — async callbacks disabled: ${error instanceof Error ? error.message : String(error)}`,
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
      const campaign = await (this.prisma as any).campaign.findUnique({
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
      console.error(
        `[SubmissionService] Failed to publish submission event for ${s.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
