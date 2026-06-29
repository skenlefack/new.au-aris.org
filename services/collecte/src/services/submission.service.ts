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
    // 1. Load campaign — try CollectionCampaign first (new model), fallback to legacy Campaign
    let campaign: any = await (this.prisma as any).collectionCampaign.findUnique({
      where: { id: dto.campaignId },
    });
    let isCollectionCampaign = true;

    if (!campaign) {
      // Fallback: legacy Campaign table
      campaign = await (this.prisma as any).campaign.findUnique({
        where: { id: dto.campaignId },
      });
      isCollectionCampaign = false;
    }

    if (!campaign) {
      throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
    }

    if (campaign.status !== 'ACTIVE') {
      throw new HttpError(
        400,
        `Campaign ${dto.campaignId} is not active (status: ${campaign.status})`,
      );
    }

    // Deadline enforcement: check start_date and end_date
    const now = new Date();
    const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (campaign.startDate) {
      const startDate = new Date(campaign.startDate);
      if (now < startDate) {
        throw new HttpError(
          400,
          `Campaign has not started yet. Submissions are accepted from ${startDate.toISOString().slice(0, 10)}`,
        );
      }
    }

    if (campaign.endDate) {
      const endDate = new Date(campaign.endDate);
      const deadlineWithGrace = new Date(endDate.getTime() + GRACE_PERIOD_MS);
      if (now > deadlineWithGrace) {
        throw new HttpError(
          400,
          `Campaign has ended. Submissions are no longer accepted after ${endDate.toISOString().slice(0, 10)} (24h grace period expired)`,
        );
      }
    }

    // Tenant isolation
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      if (isCollectionCampaign) {
        // CollectionCampaign: owner OR targeted country/REC can submit
        const canAccess = await this.canAccessCollectionCampaign(user, campaign);
        if (!canAccess) {
          throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
        }
      } else {
        // Legacy Campaign: strict tenantId match
        if (campaign.tenantId && campaign.tenantId !== user.tenantId) {
          throw new HttpError(404, `Campaign ${dto.campaignId} not found`);
        }
      }
    }

    // Resolve template ID (CollectionCampaign uses formTemplateId, legacy uses templateId)
    const templateId = isCollectionCampaign ? campaign.formTemplateId : campaign.templateId;

    // 2. Validate required fields against form template
    const schemaErrors = await this.validateAgainstTemplate(
      templateId,
      dto.data,
    );
    if (schemaErrors.length > 0) {
      const err = new HttpError(400, 'Submission data does not match template schema');
      (err as any).errors = schemaErrors.map((e) => ({
        field: e.instancePath || '/',
        message: e.message ?? 'Validation error',
      }));
      throw err;
    }

    // 3. Persist submission
    const submission = await (this.prisma as any).submission.create({
      data: {
        tenantId: user.tenantId,
        campaignId: dto.campaignId,
        templateId,
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
      campaign.domain ?? 'collecte', // Backward compat: reads legacy domain field, prefer targets[]
      user,
    );

    // 5. Publish submission event
    await this.publishSubmittedEvent(submission, user);

    // 6. Send notification to kit_recipient (if present in form data)
    await this.sendRecipientNotification(submission, dto.data, user);

    console.log(
      `[SubmissionService] Submission created: ${submission.id} for campaign ${dto.campaignId}`,
    );

    return { data: submission as unknown as SubmissionEntity };
  }

  /**
   * Update submission status (VALIDATED or REJECTED).
   * Used for confirmation workflows (e.g., kit reception confirmation).
   */
  async updateStatus(
    id: string,
    dto: { status: string; reason?: string },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    const submission = await (this.prisma as any).submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new HttpError(404, `Submission ${id} not found`);
    }

    // Allow: the kit_recipient, the submitter, DATA_STEWARD, or any admin
    const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD'].includes(user.role);
    const isRecipient = submission.data?.kit_recipient === user.userId;
    const isSubmitter = submission.submittedBy === user.userId;
    if (!isAdmin && !isRecipient && !isSubmitter) {
      throw new HttpError(403, 'Not authorized to update this submission status');
    }

    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.reason ? { qualityReportId: null } : {}),
      },
    });

    console.log(
      `[SubmissionService] Submission ${id} status updated to ${dto.status} by ${user.email}${dto.reason ? ` (reason: ${dto.reason})` : ''}`,
    );

    return { data: updated as unknown as SubmissionEntity };
  }

  /**
   * Update submission data for correction/resubmission.
   * Only allowed when status is RETURNED or REJECTED.
   * Resets status to SUBMITTED, increments version, and re-triggers quality validation.
   */
  async updateData(
    id: string,
    data: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SubmissionEntity>> {
    // 1. Find submission
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

    // 2. Guard: only allow update if status is RETURNED or REJECTED
    const editableStatuses = ['RETURNED', 'REJECTED'];
    if (!editableStatuses.includes(submission.status)) {
      throw new HttpError(
        400,
        `Submission ${id} cannot be edited (status: ${submission.status}). Only RETURNED or REJECTED submissions can be corrected.`,
      );
    }

    // Authorization: submitter or admin
    const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN'].includes(user.role);
    if (!isAdmin && submission.submittedBy !== user.userId) {
      throw new HttpError(403, 'Not authorized to edit this submission');
    }

    // 3. Update submission: new data, reset status to SUBMITTED, increment version
    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: {
        data: data as Prisma.InputJsonValue,
        status: 'SUBMITTED',
        version: { increment: 1 },
      },
    });

    // 4. Re-trigger quality validation via Kafka event
    // Resolve campaign domain
    let domain = 'collecte';
    try {
      let cam = await (this.prisma as any).collectionCampaign.findUnique({
        where: { id: submission.campaignId },
        select: { domain: true },
      });
      if (!cam) {
        cam = await (this.prisma as any).campaign.findUnique({
          where: { id: submission.campaignId },
          select: { domain: true },
        });
      }
      if (cam?.domain) domain = cam.domain;
    } catch {
      // best effort
    }

    await this.requestQualityValidation(
      { id: updated.id, data: updated.data, templateId: updated.templateId },
      domain,
      user,
    );

    // 5. Publish resubmission event
    await this.publishSubmittedEvent(updated, user);

    console.log(
      `[SubmissionService] Submission ${id} data updated and resubmitted by ${user.email} (version ${updated.version})`,
    );

    return { data: updated as unknown as SubmissionEntity };
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

    // Enrich with campaign info (name + domain)
    const campaignIds = [...new Set(data.map((s: any) => s.campaignId).filter(Boolean))];
    let campaignMap: Record<string, { name: unknown; domain: string }> = {};
    if (campaignIds.length > 0) {
      try {
        const campaigns = await (this.prisma as any).collectionCampaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true, domain: true },
        });
        for (const c of campaigns) {
          campaignMap[c.id] = { name: c.name, domain: c.domain };
        }
      } catch {
        // Campaign table may not exist or FK missing — skip enrichment
      }
    }

    const enriched = data.map((s: any) => {
      const campaign = campaignMap[s.campaignId];
      return {
        ...s,
        campaignName: campaign?.name ?? null,
        domain: campaign?.domain ?? null,
      };
    });

    return {
      data: enriched as unknown as SubmissionEntity[],
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
   * Validate submission data against the form template's required fields.
   * The template schema uses FormBuilder format (sections/fields), not JSON Schema.
   * We extract required fields and check that they have non-empty values.
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

      if (!template?.schema) {
        console.warn(
          `[SubmissionService] Template ${templateId} not found — skipping validation`,
        );
        return [];
      }

      const schema = template.schema as Record<string, unknown>;

      // FormBuilder schemas have { sections: [...], settings: {...} }
      // Validate required fields from section definitions
      if (Array.isArray(schema.sections)) {
        const errors: { instancePath: string; message?: string }[] = [];
        for (const section of schema.sections as any[]) {
          if (!Array.isArray(section?.fields)) continue;
          for (const field of section.fields) {
            if (!field?.required || field.hidden) continue;
            // Skip layout-only fields
            if (['heading', 'divider', 'spacer', 'info-box'].includes(field.type)) continue;
            const val = data[field.code];
            if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
              const label = field.label?.en || field.label?.fr || field.code;
              errors.push({
                instancePath: `/${field.code}`,
                message: `${label} is required`,
              });
            }
          }
        }
        return errors;
      }

      // Fallback: if schema looks like JSON Schema (has "type" or "properties"), use AJV
      if (schema.type || schema.properties) {
        const validate = this.ajv.compile(schema);
        const valid = validate(data);
        if (!valid && validate.errors) {
          return validate.errors.map((e) => ({
            instancePath: e.instancePath ?? '',
            message: e.message,
          }));
        }
      }
    } catch (error) {
      console.warn(
        `[SubmissionService] Template validation skipped: ${error instanceof Error ? error.message : String(error)}`,
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
    campaignId?: string,
  ): Promise<void> {
    if (!this.kafka) return;

    try {
      const event: Omit<WorkflowInstanceRequestedEvent, 'eventId' | 'timestamp'> & { payload: { campaignId?: string } } = {
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
          campaignId,
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

    const submission = await (this.prisma as any).submission.update({
      where: { id: submissionId },
      data: {
        qualityReportId: reportId,
        status: passed ? 'VALIDATED' : 'REJECTED',
      },
    });

    if (passed) {
      console.log(`[SubmissionService] Submission ${submissionId} passed quality gates`);
      await this.requestWorkflowCreation(submissionId, domain, reportId, tenantId, userId, submission.campaignId);
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

  /**
   * List submissions with conflict status (PENDING resolution).
   */
  async findConflicts(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SubmissionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      conflictStatus: 'PENDING',
    };

    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { conflictDetectedAt: 'desc' },
      }),
      (this.prisma as any).submission.count({ where }),
    ]);

    return {
      data: data as unknown as SubmissionEntity[],
      meta: { total, page, limit },
    };
  }

  /**
   * Resolve a sync conflict on a submission.
   *
   * - KEEP_SERVER: Clear conflict flag, keep current server data.
   * - KEEP_CLIENT: Replace data with the stored client version.
   * - MERGE: Replace data with the provided mergedData.
   */
  async resolveConflict(
    id: string,
    dto: {
      resolution: 'KEEP_SERVER' | 'KEEP_CLIENT' | 'MERGE';
      mergedData?: Record<string, unknown>;
    },
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

    if (submission.conflictStatus !== 'PENDING') {
      throw new HttpError(400, `Submission ${id} has no pending conflict`);
    }

    // Authorization: admin roles only
    const isAdmin = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD'].includes(user.role);
    if (!isAdmin) {
      throw new HttpError(403, 'Not authorized to resolve conflicts');
    }

    const updateData: Record<string, unknown> = {
      status: 'SUBMITTED', // Reset to SUBMITTED for re-processing
      conflictStatus: 'RESOLVED',
      conflictResolvedAt: new Date(),
      conflictResolvedBy: user.userId,
      version: { increment: 1 },
    };

    if (dto.resolution === 'KEEP_CLIENT') {
      if (!submission.conflictClientData) {
        throw new HttpError(400, 'No client data available for this conflict');
      }
      updateData['data'] = submission.conflictClientData;
    } else if (dto.resolution === 'MERGE') {
      if (!dto.mergedData) {
        throw new HttpError(400, 'mergedData is required for MERGE resolution');
      }
      updateData['data'] = dto.mergedData as any;
    }
    // KEEP_SERVER: no data change needed

    const updated = await (this.prisma as any).submission.update({
      where: { id },
      data: updateData,
    });

    console.log(
      `[SubmissionService] Conflict resolved for submission ${id}: ${dto.resolution} by ${user.email}`,
    );

    return { data: updated as unknown as SubmissionEntity };
  }

  /**
   * Check if user can access a CollectionCampaign (owner, targeted country, or targeted REC).
   * Mirrors WorkflowEngineService.canAccessCampaign logic.
   */
  private async canAccessCollectionCampaign(
    user: AuthenticatedUser,
    campaign: { ownerId: string | null; targetCountries: unknown; targetRecIds: unknown },
  ): Promise<boolean> {
    if (campaign.ownerId === user.tenantId) return true;

    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: user.tenantId },
      select: { level: true, countryCode: true },
    });
    if (!tenant) return false;

    const targetCountries = Array.isArray(campaign.targetCountries)
      ? (campaign.targetCountries as string[]).map((c: string) => c.toUpperCase())
      : [];
    const targetRecIds = Array.isArray(campaign.targetRecIds)
      ? (campaign.targetRecIds as string[])
      : [];

    if (tenant.level === 'MEMBER_STATE' && tenant.countryCode) {
      return targetCountries.includes(tenant.countryCode.toUpperCase());
    }

    if (tenant.level === 'REC') {
      if (targetRecIds.includes(user.tenantId)) return true;
      const memberTenants = await (this.prisma as any).tenant.findMany({
        where: { parentId: user.tenantId, level: 'MEMBER_STATE' },
        select: { countryCode: true },
      });
      const memberCodes: string[] = memberTenants
        .map((t: { countryCode: string | null }) => t.countryCode?.toUpperCase())
        .filter(Boolean);
      return targetCountries.some((c: string) => memberCodes.includes(c));
    }

    return false;
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

    // Load campaign domain for the event (try CollectionCampaign first, then legacy)
    try {
      let cam = await (this.prisma as any).collectionCampaign.findUnique({
        where: { id: s.campaignId },
        select: { domain: true },
      });
      if (!cam) {
        cam = await (this.prisma as any).campaign.findUnique({
          where: { id: s.campaignId },
          select: { domain: true },
        });
      }
      payload.domain = cam?.domain;
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

  /**
   * Send in-app notification to kit_recipient when form data includes a user-select field.
   * Non-blocking: errors are logged but don't fail the submission.
   */
  private async sendRecipientNotification(
    submission: { id: string; campaignId: string; data: unknown },
    formData: Record<string, unknown>,
    submitter: AuthenticatedUser,
  ): Promise<void> {
    const recipientUserId = formData.kit_recipient as string | undefined;
    if (!recipientUserId || typeof recipientUserId !== 'string') return;

    try {
      const country = formData.destination_country;
      const countryName = typeof country === 'object' && country
        ? (country as Record<string, string>).level_0 || 'your country'
        : String(country || 'your country');
      const kitFormat = formData.kit_format || '';
      const quantity = formData.quantity || '';
      const shipmentNum = formData.shipment_number || '';

      // Create in-app notification via direct DB insert (message service may not be reachable)
      await (this.prisma as any).$executeRawUnsafe(
        `INSERT INTO message.notifications (id, tenant_id, user_id, channel, subject, body, status, metadata, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'inApp', $3, $4, 'SENT', $5::jsonb, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        submitter.tenantId,
        recipientUserId,
        'PPR Kit Shipment — Please confirm reception',
        `PPR diagnostic kits (${kitFormat}, qty: ${quantity}) have been shipped to ${countryName}. Shipment #${shipmentNum}. Please confirm reception in the Collecte module.`,
        JSON.stringify({
          submissionId: submission.id,
          campaignId: submission.campaignId,
          action: 'confirm_kit_reception',
        }),
      );

      console.log(
        `[SubmissionService] Kit notification sent to user ${recipientUserId} for submission ${submission.id}`,
      );
    } catch (error) {
      console.warn(
        `[SubmissionService] Failed to send kit notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
