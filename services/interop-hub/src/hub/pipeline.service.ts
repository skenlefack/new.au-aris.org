// ═══════════════════════════════════════════════════════════════════
//  Pipeline Manager — CRUD + default step generation
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaEvent } from '@aris/shared-types';
import {
  TOPIC_AU_HUB_PIPELINE_ACTIVATED,
  TOPIC_AU_HUB_PIPELINE_PAUSED,
  TOPIC_AU_HUB_PIPELINE_ERROR,
} from '@aris/shared-types';
import type {
  HubPipeline,
  HubPipelineStep,
  HubPipelineStatus,
  HubPipelineMode,
  HubDirection,
  HubStepType,
  CreatePipelineDto,
  UpdatePipelineDto,
  CreatePipelineStepDto,
  UpdatePipelineStepDto,
  PaginationParams,
  PaginatedResult,
  HubLogger,
} from './types';

const KAFKA_TIMEOUT_MS = 5_000;
const SERVICE_NAME = 'interop-hub';

// Default step sequences per direction
const INBOUND_STEPS: Array<{ step_type: HubStepType; name: string }> = [
  { step_type: 'RECEIVE', name: 'Receive data' },
  { step_type: 'REFERENTIAL_MAP', name: 'Map referentials' },
  { step_type: 'FIELD_TRANSFORM', name: 'Transform fields' },
  { step_type: 'SCHEMA_VALIDATE', name: 'Validate schema' },
  { step_type: 'QUALITY_GATE', name: 'Quality gates' },
  { step_type: 'ROUTE', name: 'Route to campaign' },
];

const OUTBOUND_STEPS: Array<{ step_type: HubStepType; name: string }> = [
  { step_type: 'RECEIVE', name: 'Receive data' },
  { step_type: 'ENRICH', name: 'Enrich from master data' },
  { step_type: 'REFERENTIAL_MAP', name: 'Map referentials' },
  { step_type: 'FIELD_TRANSFORM', name: 'Transform fields' },
  { step_type: 'FORMAT_BUILD', name: 'Build target format' },
  { step_type: 'DELIVER', name: 'Deliver to external system' },
];

export class PipelineService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubPipeline;
  }

  private get stepDb() {
    return (this.prisma as any).hubPipelineStep;
  }

  private async publishEvent(topic: string, key: string, payload: Record<string, unknown>, tenantId: string): Promise<void> {
    const event: KafkaEvent<Record<string, unknown>> = {
      id: randomUUID(),
      topic,
      key,
      payload,
      headers: {
        correlationId: randomUUID(),
        sourceService: SERVICE_NAME,
        tenantId,
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      version: 1,
    };

    try {
      await Promise.race([
        this.kafka.publish(event),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout')), KAFKA_TIMEOUT_MS)),
      ]);
    } catch (err) {
      this.logger.warn(`Kafka publish failed for ${topic}: ${err}`);
    }
  }

  private throwHttp(statusCode: number, message: string): never {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    throw err;
  }

  // ─── Pipeline CRUD ──────────────────────────────────────────────

  async create(dto: CreatePipelineDto): Promise<HubPipeline> {
    // Validate connection exists
    const connection = await (this.prisma as any).hubConnection.findFirst({
      where: { id: dto.connection_id, tenant_id: dto.tenant_id },
    });
    if (!connection) {
      this.throwHttp(404, `Connection ${dto.connection_id} not found`);
    }

    // Unique: connection_id + domain + direction
    const existing = await this.db.findFirst({
      where: {
        connection_id: dto.connection_id,
        domain: dto.domain,
        direction: dto.direction,
      },
    });
    if (existing) {
      this.throwHttp(409, `Pipeline already exists for this connection, domain (${dto.domain}), and direction (${dto.direction})`);
    }

    const pipeline = await this.db.create({
      data: {
        connection_id: dto.connection_id,
        tenant_id: dto.tenant_id,
        name: dto.name,
        description: dto.description ?? null,
        direction: dto.direction,
        domain: dto.domain,
        sub_domain: dto.sub_domain ?? null,
        entity_type: dto.entity_type ?? null,
        mode: dto.mode ?? 'MANUAL',
        target_campaign_id: dto.target_campaign_id ?? null,
        target_form_id: dto.target_form_id ?? null,
        target_workflow_id: dto.target_workflow_id ?? null,
        export_format: dto.export_format ?? null,
        quality_gates_enabled: dto.quality_gates_enabled ?? true,
        min_quality_score: dto.min_quality_score ?? 0.7,
        reject_on_quality_fail: dto.reject_on_quality_fail ?? false,
        max_retries: dto.max_retries ?? 3,
        retry_delay_ms: dto.retry_delay_ms ?? 60_000,
        dlq_enabled: dto.dlq_enabled ?? true,
        created_by: dto.created_by,
      },
    });

    // Generate default steps
    await this.generateDefaultSteps(pipeline.id, dto.direction, dto.mode ?? 'MANUAL');

    // Reload with steps
    const full = await this.db.findUnique({
      where: { id: pipeline.id },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    this.logger.info(`Pipeline created: ${pipeline.id} (${pipeline.name})`);
    return full as HubPipeline;
  }

  async findAll(tenantId: string, params: PaginationParams & { connection_id?: string; direction?: HubDirection; status?: HubPipelineStatus } = {}): Promise<PaginatedResult<HubPipeline>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (params.connection_id) where.connection_id = params.connection_id;
    if (params.direction) where.direction = params.direction;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        include: { steps: { orderBy: { step_order: 'asc' } }, connection: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubPipeline[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, tenantId: string): Promise<HubPipeline> {
    const pipeline = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        steps: { orderBy: { step_order: 'asc' } },
        connection: true,
      },
    });
    if (!pipeline) {
      this.throwHttp(404, `Pipeline ${id} not found`);
    }
    return pipeline as HubPipeline;
  }

  async update(id: string, tenantId: string, dto: UpdatePipelineDto): Promise<HubPipeline> {
    const existing = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      this.throwHttp(404, `Pipeline ${id} not found`);
    }

    const pipeline = await this.db.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.target_campaign_id !== undefined && { target_campaign_id: dto.target_campaign_id }),
        ...(dto.target_form_id !== undefined && { target_form_id: dto.target_form_id }),
        ...(dto.target_workflow_id !== undefined && { target_workflow_id: dto.target_workflow_id }),
        ...(dto.export_format !== undefined && { export_format: dto.export_format }),
        ...(dto.quality_gates_enabled !== undefined && { quality_gates_enabled: dto.quality_gates_enabled }),
        ...(dto.min_quality_score !== undefined && { min_quality_score: dto.min_quality_score }),
        ...(dto.reject_on_quality_fail !== undefined && { reject_on_quality_fail: dto.reject_on_quality_fail }),
        ...(dto.max_retries !== undefined && { max_retries: dto.max_retries }),
        ...(dto.retry_delay_ms !== undefined && { retry_delay_ms: dto.retry_delay_ms }),
        ...(dto.dlq_enabled !== undefined && { dlq_enabled: dto.dlq_enabled }),
      },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    // If mode changed, regenerate steps to add/remove NOTIFY step
    if (dto.mode !== undefined && dto.mode !== existing.mode) {
      await this.regenerateStepsForMode(id, existing.direction as HubDirection, dto.mode);
    }

    this.logger.info(`Pipeline updated: ${id}`);
    return pipeline as HubPipeline;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      this.throwHttp(404, `Pipeline ${id} not found`);
    }
    if (existing.status === 'ACTIVE') {
      this.throwHttp(400, 'Cannot delete an active pipeline. Pause or archive it first.');
    }
    await this.db.delete({ where: { id } });
    this.logger.info(`Pipeline deleted: ${id}`);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  async activate(id: string, tenantId: string): Promise<HubPipeline> {
    return this.changeStatus(id, tenantId, 'ACTIVE', TOPIC_AU_HUB_PIPELINE_ACTIVATED);
  }

  async pause(id: string, tenantId: string): Promise<HubPipeline> {
    return this.changeStatus(id, tenantId, 'PAUSED', TOPIC_AU_HUB_PIPELINE_PAUSED);
  }

  async archive(id: string, tenantId: string): Promise<HubPipeline> {
    return this.changeStatus(id, tenantId, 'ARCHIVED', null);
  }

  async setError(id: string, tenantId: string, errorMessage: string): Promise<HubPipeline> {
    const pipeline = await this.changeStatus(id, tenantId, 'ERROR', TOPIC_AU_HUB_PIPELINE_ERROR);
    this.logger.error(`Pipeline ${id} entered ERROR state: ${errorMessage}`);
    return pipeline;
  }

  private async changeStatus(
    id: string,
    tenantId: string,
    newStatus: HubPipelineStatus,
    kafkaTopic: string | null,
  ): Promise<HubPipeline> {
    const existing = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      this.throwHttp(404, `Pipeline ${id} not found`);
    }

    const pipeline = await this.db.update({
      where: { id },
      data: { status: newStatus },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    if (kafkaTopic) {
      await this.publishEvent(kafkaTopic, id, {
        id,
        name: pipeline.name,
        status: newStatus,
        previousStatus: existing.status,
        direction: pipeline.direction,
        domain: pipeline.domain,
      }, tenantId);
    }

    this.logger.info(`Pipeline ${id} status changed: ${existing.status} → ${newStatus}`);
    return pipeline as HubPipeline;
  }

  // ─── Step CRUD ──────────────────────────────────────────────────

  async createStep(dto: CreatePipelineStepDto): Promise<HubPipelineStep> {
    const step = await this.stepDb.create({
      data: {
        pipeline_id: dto.pipeline_id,
        step_order: dto.step_order,
        step_type: dto.step_type,
        name: dto.name,
        description: dto.description ?? null,
        is_enabled: dto.is_enabled ?? true,
        config: (dto.config ?? {}) as any,
        on_error: dto.on_error ?? 'STOP',
        timeout_ms: dto.timeout_ms ?? 30_000,
      },
    });
    return step as HubPipelineStep;
  }

  async updateStep(id: string, dto: UpdatePipelineStepDto): Promise<HubPipelineStep> {
    const existing = await this.stepDb.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Pipeline step ${id} not found`);
    }

    const step = await this.stepDb.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_enabled !== undefined && { is_enabled: dto.is_enabled }),
        ...(dto.config !== undefined && { config: dto.config as any }),
        ...(dto.on_error !== undefined && { on_error: dto.on_error }),
        ...(dto.timeout_ms !== undefined && { timeout_ms: dto.timeout_ms }),
      },
    });
    return step as HubPipelineStep;
  }

  async deleteStep(id: string): Promise<void> {
    const existing = await this.stepDb.findUnique({ where: { id } });
    if (!existing) {
      this.throwHttp(404, `Pipeline step ${id} not found`);
    }
    await this.stepDb.delete({ where: { id } });
  }

  async reorderSteps(pipelineId: string, stepIds: string[]): Promise<HubPipelineStep[]> {
    // Update step_order for each step
    const updates = stepIds.map((stepId, index) =>
      this.stepDb.update({
        where: { id: stepId },
        data: { step_order: index + 1 },
      }),
    );
    await Promise.all(updates);

    const steps = await this.stepDb.findMany({
      where: { pipeline_id: pipelineId },
      orderBy: { step_order: 'asc' },
    });
    return steps as HubPipelineStep[];
  }

  // ─── Default Step Generation ────────────────────────────────────

  async generateDefaultSteps(pipelineId: string, direction: HubDirection, mode: HubPipelineMode): Promise<void> {
    const baseSteps = direction === 'INBOUND' ? [...INBOUND_STEPS] : [...OUTBOUND_STEPS];

    // In MANUAL mode, insert a NOTIFY step before the final step (ROUTE or DELIVER)
    if (mode === 'MANUAL') {
      const lastIndex = baseSteps.length - 1;
      baseSteps.splice(lastIndex, 0, { step_type: 'NOTIFY', name: 'Notify for review' });
    }

    const creates = baseSteps.map((step, index) =>
      this.stepDb.create({
        data: {
          pipeline_id: pipelineId,
          step_order: index + 1,
          step_type: step.step_type,
          name: step.name,
          is_enabled: true,
          config: {},
          on_error: 'STOP',
          timeout_ms: 30_000,
        },
      }),
    );

    await Promise.all(creates);
  }

  /** Regenerate steps when pipeline mode changes. */
  private async regenerateStepsForMode(pipelineId: string, direction: HubDirection, newMode: HubPipelineMode): Promise<void> {
    // Delete all existing steps
    await this.stepDb.deleteMany({ where: { pipeline_id: pipelineId } });
    // Create new default steps
    await this.generateDefaultSteps(pipelineId, direction, newMode);
    this.logger.info(`Steps regenerated for pipeline ${pipelineId} with mode ${newMode}`);
  }

  // ─── Stats ──────────────────────────────────────────────────────

  async incrementRunStats(id: string, success: boolean): Promise<void> {
    await this.db.update({
      where: { id },
      data: {
        total_runs: { increment: 1 },
        ...(success ? { successful_runs: { increment: 1 } } : { failed_runs: { increment: 1 } }),
        last_run_at: new Date(),
        last_run_status: success ? 'COMPLETED' : 'FAILED',
      },
    });
  }
}
