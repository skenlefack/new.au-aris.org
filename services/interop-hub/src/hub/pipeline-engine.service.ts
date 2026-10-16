// ═══════════════════════════════════════════════════════════════════
//  Pipeline Execution Engine — Runs pipeline steps sequentially
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaEvent } from '@aris/shared-types';
import {
  TOPIC_AU_HUB_INBOUND_RECEIVED,
  TOPIC_AU_HUB_INBOUND_MAPPED,
  TOPIC_AU_HUB_INBOUND_VALIDATED,
  TOPIC_AU_HUB_INBOUND_AWAITING_REVIEW,
  TOPIC_AU_HUB_INBOUND_APPROVED,
  TOPIC_AU_HUB_INBOUND_LOADED,
  TOPIC_AU_HUB_INBOUND_FAILED,
  TOPIC_AU_HUB_OUTBOUND_PREPARED,
  TOPIC_AU_HUB_OUTBOUND_AWAITING_REVIEW,
  TOPIC_AU_HUB_OUTBOUND_DELIVERED,
  TOPIC_AU_HUB_OUTBOUND_FAILED,
  TOPIC_AU_HUB_DLQ,
} from '@aris/shared-types';
import type {
  HubPipeline,
  HubPipelineStep,
  HubTransaction,
  HubTransactionStatus,
  HubStepType,
  HubStepOnError,
  HubStepLogStatus,
  PipelineExecutionInput,
  StepResult,
  ReceiveStepConfig,
  ReferentialMapStepConfig,
  FieldTransformStepConfig,
  SchemaValidateStepConfig,
  QualityGateStepConfig,
  EnrichStepConfig,
  FormatBuildStepConfig,
  RouteStepConfig,
  NotifyStepConfig,
  DeliverStepConfig,
  HubLogger,
} from './types';
import type { MappingService } from './mapping.service';
import type { NotificationService } from './notification.service';

const KAFKA_TIMEOUT_MS = 5_000;
const SERVICE_NAME = 'interop-hub';

/** Status mapping: step type -> transaction status while that step is running */
const STEP_STATUS_MAP: Partial<Record<HubStepType, HubTransactionStatus>> = {
  RECEIVE: 'RECEIVED',
  REFERENTIAL_MAP: 'MAPPING',
  FIELD_TRANSFORM: 'TRANSFORMING',
  SCHEMA_VALIDATE: 'VALIDATING',
  QUALITY_GATE: 'VALIDATING',
  ENRICH: 'MAPPING',
  FORMAT_BUILD: 'TRANSFORMING',
  ROUTE: 'LOADING',
  NOTIFY: 'AWAITING_REVIEW',
  DELIVER: 'LOADING',
};

export class PipelineEngineService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly mappingService: MappingService,
    private readonly notificationService: NotificationService,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get txDb() {
    return (this.prisma as any).hubTransaction;
  }

  private get recordDb() {
    return (this.prisma as any).hubTransactionRecord;
  }

  private get stepLogDb() {
    return (this.prisma as any).hubTransactionStepLog;
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

  // ─── Main Execution ─────────────────────────────────────────────

  async executePipeline(
    pipelineId: string,
    input: PipelineExecutionInput,
    initiatedBy: string,
  ): Promise<HubTransaction> {
    // Load pipeline with steps and connection
    const pipeline = await (this.prisma as any).hubPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        steps: { where: { is_enabled: true }, orderBy: { step_order: 'asc' } },
        connection: true,
      },
    }) as (HubPipeline & { steps: HubPipelineStep[]; connection: any }) | null;

    if (!pipeline) {
      this.throwHttp(404, `Pipeline ${pipelineId} not found`);
    }
    if (pipeline.status !== 'ACTIVE') {
      this.throwHttp(400, `Pipeline ${pipelineId} is not active (status: ${pipeline.status})`);
    }
    if (!pipeline.steps || pipeline.steps.length === 0) {
      this.throwHttp(400, `Pipeline ${pipelineId} has no enabled steps`);
    }

    // Create transaction
    const startedAt = new Date();
    const transaction = await this.txDb.create({
      data: {
        pipeline_id: pipelineId,
        connection_id: pipeline.connection_id,
        tenant_id: pipeline.tenant_id,
        direction: pipeline.direction,
        status: 'RECEIVED' as HubTransactionStatus,
        mode: pipeline.mode,
        domain: pipeline.domain,
        entity_type: pipeline.entity_type,
        country_code: pipeline.connection?.country_code ?? null,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        export_format: pipeline.export_format,
        records_total: input.records.length,
        source_payload: input.records as any,
        source_file_url: input.source_file_url ?? null,
        source_file_name: input.source_file_name ?? null,
        source_file_size: input.source_file_size ?? null,
        max_retries: pipeline.max_retries,
        initiated_by: initiatedBy,
        started_at: startedAt,
      },
    });

    const txId = transaction.id;
    const tenantId = pipeline.tenant_id;

    // Publish received event
    const receivedTopic = pipeline.direction === 'INBOUND' ? TOPIC_AU_HUB_INBOUND_RECEIVED : TOPIC_AU_HUB_OUTBOUND_PREPARED;
    await this.publishEvent(receivedTopic, txId, { transactionId: txId, pipelineId, records: input.records.length }, tenantId);

    // Execute steps sequentially
    let currentRecords = [...input.records];
    let finalStatus: HubTransactionStatus = 'COMPLETED';
    let errorMessage: string | null = null;
    let stoppedAtNotify = false;

    for (const step of pipeline.steps) {
      // Update transaction status
      const stepStatus = STEP_STATUS_MAP[step.step_type as HubStepType] ?? 'QUEUED';
      await this.txDb.update({
        where: { id: txId },
        data: { status: stepStatus, current_step: step.name },
      });

      const stepStart = Date.now();
      let logStatus: HubStepLogStatus = 'STARTED';
      let stepErrorMsg: string | null = null;
      let stepResult: StepResult | null = null;

      try {
        // Execute step with timeout
        stepResult = await this.executeWithTimeout(
          () => this.executeStep(step, currentRecords, transaction, pipeline),
          step.timeout_ms,
        );

        if (stepResult.success) {
          logStatus = 'COMPLETED';
          currentRecords = stepResult.records;
        } else {
          logStatus = 'FAILED';
          stepErrorMsg = stepResult.errors?.map(e => e.message).join('; ') ?? 'Step failed';
        }
      } catch (err: any) {
        logStatus = 'FAILED';
        stepErrorMsg = err.message ?? 'Unknown step error';
      }

      const stepDuration = Date.now() - stepStart;

      // Write step log
      await this.stepLogDb.create({
        data: {
          transaction_id: txId,
          step_type: step.step_type,
          step_name: step.name,
          step_order: step.step_order,
          status: logStatus,
          input_summary: { record_count: currentRecords.length } as any,
          output_summary: stepResult ? { record_count: stepResult.records.length, errors: stepResult.errors?.length ?? 0 } as any : null,
          error_message: stepErrorMsg,
          duration_ms: stepDuration,
          started_at: new Date(stepStart),
          completed_at: new Date(),
        },
      });

      // Handle step failure
      if (logStatus === 'FAILED') {
        const onError = step.on_error as HubStepOnError;

        if (onError === 'SKIP') {
          this.logger.warn(`Step "${step.name}" failed but on_error=SKIP, continuing. Error: ${stepErrorMsg}`);
          continue;
        }
        if (onError === 'CONTINUE') {
          this.logger.warn(`Step "${step.name}" failed but on_error=CONTINUE. Error: ${stepErrorMsg}`);
          continue;
        }
        if (onError === 'RETRY') {
          // Retry logic — mark for retry and break
          finalStatus = 'RETRY';
          errorMessage = stepErrorMsg;
          break;
        }
        // STOP (default)
        finalStatus = 'FAILED';
        errorMessage = stepErrorMsg;
        break;
      }

      // MANUAL mode: pause at NOTIFY step
      if (step.step_type === 'NOTIFY' && pipeline.mode === 'MANUAL') {
        finalStatus = 'AWAITING_REVIEW';
        stoppedAtNotify = true;

        // Store mapped payload for review
        await this.txDb.update({
          where: { id: txId },
          data: { mapped_payload: currentRecords as any },
        });

        const awaitTopic = pipeline.direction === 'INBOUND' ? TOPIC_AU_HUB_INBOUND_AWAITING_REVIEW : TOPIC_AU_HUB_OUTBOUND_AWAITING_REVIEW;
        await this.publishEvent(awaitTopic, txId, { transactionId: txId, records: currentRecords.length }, tenantId);
        break;
      }
    }

    // Finalize transaction
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Count record statuses
    let recordsAccepted = 0;
    let recordsRejected = 0;
    let recordsWarning = 0;

    if (finalStatus === 'COMPLETED' || finalStatus === 'PARTIAL') {
      // Create transaction records
      for (let i = 0; i < currentRecords.length; i++) {
        const recordStatus = 'ACCEPTED';
        await this.recordDb.create({
          data: {
            transaction_id: txId,
            record_index: i,
            status: recordStatus,
            source_data: (input.records[i] ?? null) as any,
            mapped_data: (currentRecords[i] ?? null) as any,
            target_data: (currentRecords[i] ?? null) as any,
          },
        });
        recordsAccepted++;
      }
    }

    await this.txDb.update({
      where: { id: txId },
      data: {
        status: finalStatus,
        current_step: stoppedAtNotify ? 'AWAITING_REVIEW' : null,
        target_payload: finalStatus === 'COMPLETED' ? (currentRecords as any) : null,
        records_accepted: recordsAccepted,
        records_rejected: recordsRejected,
        records_warning: recordsWarning,
        error_message: errorMessage,
        completed_at: stoppedAtNotify ? null : completedAt,
        duration_ms: stoppedAtNotify ? null : durationMs,
      },
    });

    // Update pipeline stats
    const success = finalStatus === 'COMPLETED';
    await (this.prisma as any).hubPipeline.update({
      where: { id: pipelineId },
      data: {
        total_runs: { increment: 1 },
        ...(success ? { successful_runs: { increment: 1 } } : {}),
        ...(!success && finalStatus !== 'AWAITING_REVIEW' ? { failed_runs: { increment: 1 } } : {}),
        last_run_at: new Date(),
        last_run_status: finalStatus,
      },
    });

    // Update connection stats
    await (this.prisma as any).hubConnection.update({
      where: { id: pipeline.connection_id },
      data: {
        total_transactions: { increment: 1 },
        total_records: { increment: input.records.length },
        ...(!success && finalStatus !== 'AWAITING_REVIEW' ? { total_errors: { increment: 1 } } : {}),
        last_transaction_at: new Date(),
      },
    });

    // Publish completion/failure events
    if (finalStatus === 'COMPLETED') {
      const completedTopic = pipeline.direction === 'INBOUND' ? TOPIC_AU_HUB_INBOUND_LOADED : TOPIC_AU_HUB_OUTBOUND_DELIVERED;
      await this.publishEvent(completedTopic, txId, { transactionId: txId, records: recordsAccepted }, tenantId);
    } else if (finalStatus === 'FAILED') {
      const failedTopic = pipeline.direction === 'INBOUND' ? TOPIC_AU_HUB_INBOUND_FAILED : TOPIC_AU_HUB_OUTBOUND_FAILED;
      await this.publishEvent(failedTopic, txId, { transactionId: txId, error: errorMessage }, tenantId);

      // DLQ
      if (pipeline.dlq_enabled) {
        await this.publishEvent(TOPIC_AU_HUB_DLQ, txId, {
          transactionId: txId,
          pipelineId,
          error: errorMessage,
          records: input.records,
        }, tenantId);
      }
    }

    // Reload full transaction
    return await this.txDb.findUnique({
      where: { id: txId },
      include: { records: true, steps_log: { orderBy: { step_order: 'asc' } } },
    }) as HubTransaction;
  }

  // ─── Step Execution Router ──────────────────────────────────────

  private async executeStep(
    step: HubPipelineStep,
    records: Record<string, unknown>[],
    transaction: any,
    pipeline: HubPipeline & { connection?: any },
  ): Promise<StepResult> {
    const config = (step.config ?? {}) as Record<string, unknown>;

    switch (step.step_type as HubStepType) {
      case 'RECEIVE':
        return this.stepReceive(records, config as ReceiveStepConfig);
      case 'REFERENTIAL_MAP':
        return this.stepReferentialMap(records, config as ReferentialMapStepConfig, pipeline);
      case 'FIELD_TRANSFORM':
        return this.stepFieldTransform(records, config as FieldTransformStepConfig, pipeline);
      case 'SCHEMA_VALIDATE':
        return this.stepSchemaValidate(records, config as SchemaValidateStepConfig);
      case 'QUALITY_GATE':
        return this.stepQualityGate(records, config as QualityGateStepConfig, pipeline);
      case 'ENRICH':
        return this.stepEnrich(records, config as EnrichStepConfig);
      case 'FORMAT_BUILD':
        return this.stepFormatBuild(records, config as FormatBuildStepConfig, pipeline);
      case 'ROUTE':
        return this.stepRoute(records, config as RouteStepConfig, pipeline, transaction);
      case 'NOTIFY':
        return this.stepNotify(records, config as NotifyStepConfig, pipeline, transaction);
      case 'DELIVER':
        return this.stepDeliver(records, config as DeliverStepConfig, pipeline, transaction);
      default:
        return { success: false, records, errors: [{ record_index: -1, message: `Unknown step type: ${step.step_type}` }] };
    }
  }

  // ─── Step Handlers ──────────────────────────────────────────────

  private async stepReceive(
    records: Record<string, unknown>[],
    config: ReceiveStepConfig,
  ): Promise<StepResult> {
    // Parse input — if records_path is specified, extract from that path
    let extracted = records;
    if (config.records_path && records.length === 1) {
      const root = records[0];
      const path = config.records_path.split('.');
      let current: any = root;
      for (const key of path) {
        current = current?.[key];
      }
      if (Array.isArray(current)) {
        extracted = current;
      }
    }

    // Enforce max batch size
    if (config.max_batch_size && extracted.length > config.max_batch_size) {
      return {
        success: false,
        records: extracted,
        errors: [{ record_index: -1, message: `Batch size ${extracted.length} exceeds maximum ${config.max_batch_size}` }],
      };
    }

    return { success: true, records: extracted };
  }

  private async stepReferentialMap(
    records: Record<string, unknown>[],
    config: ReferentialMapStepConfig,
    pipeline: HubPipeline,
  ): Promise<StepResult> {
    try {
      const mapped = await this.mappingService.applyReferentialMappings(
        pipeline.connection_id,
        records,
        pipeline.direction,
        config.referential_types,
      );
      return { success: true, records: mapped };
    } catch (err: any) {
      if (config.strict) {
        return { success: false, records, errors: [{ record_index: -1, message: err.message }] };
      }
      this.logger.warn(`Referential mapping had warnings: ${err.message}`);
      return { success: true, records };
    }
  }

  private async stepFieldTransform(
    records: Record<string, unknown>[],
    config: FieldTransformStepConfig,
    pipeline: HubPipeline,
  ): Promise<StepResult> {
    try {
      // If inline JSONata expression is provided, use it
      if (config.inline_expression) {
        const jsonata = await import('jsonata');
        const expression = jsonata.default(config.inline_expression);
        const transformed = await Promise.all(
          records.map(async (record) => {
            const result = await expression.evaluate(record);
            return (result ?? record) as Record<string, unknown>;
          }),
        );
        return { success: true, records: transformed };
      }

      // Otherwise, use DB field mappings
      const entityType = config.entity_type ?? pipeline.entity_type ?? pipeline.domain;
      const transformed = await this.mappingService.applyFieldMappings(
        pipeline.connection_id,
        entityType,
        records,
        pipeline.direction,
      );
      return { success: true, records: transformed };
    } catch (err: any) {
      return { success: false, records, errors: [{ record_index: -1, message: `Field transform error: ${err.message}` }] };
    }
  }

  private async stepSchemaValidate(
    records: Record<string, unknown>[],
    config: SchemaValidateStepConfig,
  ): Promise<StepResult> {
    if (!config.json_schema) {
      // No schema configured — pass through
      return { success: true, records };
    }

    try {
      const Ajv = (await import('ajv')).default;
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(config.json_schema);

      const errors: StepResult['errors'] = [];
      const warnings: StepResult['warnings'] = [];

      for (let i = 0; i < records.length; i++) {
        const valid = validate(records[i]);
        if (!valid && validate.errors) {
          const msgs = validate.errors.map(e => `${e.instancePath || '/'}: ${e.message}`);
          if (config.strict) {
            errors.push({ record_index: i, message: msgs.join('; ') });
          } else {
            warnings.push({ record_index: i, message: msgs.join('; ') });
          }
        }
      }

      if (errors.length > 0) {
        return { success: false, records, errors };
      }
      return { success: true, records, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (err: any) {
      return { success: false, records, errors: [{ record_index: -1, message: `Schema validation setup error: ${err.message}` }] };
    }
  }

  private async stepQualityGate(
    records: Record<string, unknown>[],
    config: QualityGateStepConfig,
    pipeline: HubPipeline,
  ): Promise<StepResult> {
    const qualityUrl = config.quality_service_url ?? process.env['DATA_QUALITY_URL'] ?? 'http://localhost:3004';
    const minScore = config.min_score ?? pipeline.min_quality_score ?? 0.7;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${qualityUrl}/api/v1/data-quality/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, rules: config.rules ?? [], domain: pipeline.domain }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(`Quality gate service returned ${response.status}, passing through`);
        return { success: true, records };
      }

      const result = await response.json() as { data?: { score?: number; records?: any[] } };
      const score = result.data?.score ?? 1.0;

      if (score < minScore && pipeline.reject_on_quality_fail) {
        return {
          success: false,
          records,
          errors: [{ record_index: -1, message: `Quality score ${score.toFixed(2)} below minimum ${minScore}` }],
        };
      }

      return { success: true, records, metadata: { quality_score: score } };
    } catch (err: any) {
      // Quality service unavailable — log warning but don't block
      this.logger.warn(`Quality gate service unavailable: ${err.message}. Passing through.`);
      return { success: true, records };
    }
  }

  private async stepEnrich(
    records: Record<string, unknown>[],
    config: EnrichStepConfig,
  ): Promise<StepResult> {
    const masterDataUrl = config.master_data_url ?? process.env['MASTER_DATA_URL'] ?? 'http://localhost:3003';
    const sources = config.sources ?? ['species', 'diseases', 'geo'];

    // Best-effort enrichment — don't fail if master-data is unavailable
    try {
      for (const source of sources) {
        // Collect unique codes to look up
        const codesSet = new Set<string>();
        const codeField = `${source}_code`;

        for (const record of records) {
          const code = record[codeField] as string | undefined;
          if (code) codesSet.add(code);
        }

        if (codesSet.size === 0) continue;

        const codes = Array.from(codesSet);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        try {
          const response = await fetch(`${masterDataUrl}/api/v1/master-data/${source}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json() as { data?: Record<string, unknown>[] };
            const lookupMap = new Map<string, Record<string, unknown>>();
            for (const item of (result.data ?? [])) {
              const code = item.code as string;
              if (code) lookupMap.set(code, item);
            }

            // Enrich records
            for (const record of records) {
              const code = record[codeField] as string | undefined;
              if (code && lookupMap.has(code)) {
                const enrichment = lookupMap.get(code)!;
                record[`${source}_name`] = enrichment.name ?? enrichment.label;
                record[`${source}_id`] = enrichment.id;
              }
            }
          }
        } catch {
          // Ignore per-source failures
        }
      }

      return { success: true, records };
    } catch (err: any) {
      this.logger.warn(`Enrichment error: ${err.message}. Passing through.`);
      return { success: true, records };
    }
  }

  private async stepFormatBuild(
    records: Record<string, unknown>[],
    config: FormatBuildStepConfig,
    pipeline: HubPipeline,
  ): Promise<StepResult> {
    const format = config.format ?? pipeline.export_format;
    if (!format) {
      return { success: true, records };
    }

    // Format building is delegated to specialized builders.
    // For now, return records as-is — real adapters (WAHIS XML, FAOSTAT CSV, etc.)
    // will be implemented in Phase 7.
    return {
      success: true,
      records,
      metadata: { format, builder: 'stub' },
    };
  }

  private async stepRoute(
    records: Record<string, unknown>[],
    config: RouteStepConfig,
    pipeline: HubPipeline,
    transaction: any,
  ): Promise<StepResult> {
    if (pipeline.direction === 'INBOUND') {
      // Route to collecte service — create submissions
      const collecteUrl = config.collecte_url ?? process.env['COLLECTE_URL'] ?? 'http://localhost:3011';
      const campaignId = config.campaign_id ?? pipeline.target_campaign_id;
      const formId = config.form_id ?? pipeline.target_form_id;

      if (!campaignId || !formId) {
        return { success: false, records, errors: [{ record_index: -1, message: 'No target campaign or form configured for INBOUND routing' }] };
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const response = await fetch(`${collecteUrl}/api/v1/collecte/campaigns/${campaignId}/submissions/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            form_id: formId,
            records,
            source: 'interop-hub',
            transaction_id: transaction.id,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.text();
          return { success: false, records, errors: [{ record_index: -1, message: `Collecte service returned ${response.status}: ${body}` }] };
        }

        return { success: true, records };
      } catch (err: any) {
        return { success: false, records, errors: [{ record_index: -1, message: `Route to collecte failed: ${err.message}` }] };
      }
    }

    // OUTBOUND — prepare delivery (no-op; actual delivery in DELIVER step)
    return { success: true, records };
  }

  private async stepNotify(
    records: Record<string, unknown>[],
    config: NotifyStepConfig,
    pipeline: HubPipeline,
    transaction: any,
  ): Promise<StepResult> {
    const channels = config.channels ?? ['in_app', 'email'];
    const title = (config.title_template ?? 'Interop transaction awaiting review')
      .replace('{{domain}}', pipeline.domain)
      .replace('{{direction}}', pipeline.direction)
      .replace('{{records}}', String(records.length));
    const message = (config.message_template ?? '{{records}} records from {{domain}} ({{direction}}) require review')
      .replace('{{domain}}', pipeline.domain)
      .replace('{{direction}}', pipeline.direction)
      .replace('{{records}}', String(records.length));

    await this.notificationService.createNotification({
      tenant_id: pipeline.tenant_id,
      transaction_id: transaction.id,
      connection_id: pipeline.connection_id,
      type: pipeline.direction === 'INBOUND' ? 'INBOUND_AWAITING_REVIEW' : 'OUTBOUND_AWAITING_REVIEW',
      title,
      message,
      severity: 'INFO',
      metadata: { pipelineId: pipeline.id, records: records.length },
      channels: channels as any[],
    });

    return { success: true, records };
  }

  private async stepDeliver(
    records: Record<string, unknown>[],
    config: DeliverStepConfig,
    pipeline: HubPipeline & { connection?: any },
    transaction: any,
  ): Promise<StepResult> {
    const url = config.url ?? pipeline.connection?.base_url;
    if (!url) {
      return { success: false, records, errors: [{ record_index: -1, message: 'No delivery URL configured' }] };
    }

    const method = config.method ?? 'POST';
    const maxRetries = config.max_retries ?? 3;
    const retryDelay = config.retry_delay_ms ?? 5_000;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ARIS-InteropHub/1.0',
      ...(config.headers ?? {}),
    };

    // Add auth from connection
    if (pipeline.connection?.auth_type === 'BEARER_TOKEN') {
      const creds = pipeline.connection.credentials as Record<string, unknown>;
      if (creds.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      }
    } else if (pipeline.connection?.auth_type === 'API_KEY') {
      const creds = pipeline.connection.credentials as Record<string, unknown>;
      if (creds.header_name && creds.api_key) {
        headers[creds.header_name as string] = creds.api_key as string;
      }
    } else if (pipeline.connection?.auth_type === 'BASIC') {
      const creds = pipeline.connection.credentials as Record<string, unknown>;
      if (creds.username && creds.password) {
        const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
    }

    let lastError: string = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(records),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Update transaction with delivery details
        await this.txDb.update({
          where: { id: transaction.id },
          data: {
            delivery_url: url,
            delivery_method: method,
            delivery_status: response.status,
            delivery_response: (await response.text()).slice(0, 2000),
          },
        });

        if (response.ok) {
          return { success: true, records };
        }

        lastError = `HTTP ${response.status}`;
        if (response.status >= 400 && response.status < 500) {
          // Client error — don't retry
          return { success: false, records, errors: [{ record_index: -1, message: `Delivery failed: ${lastError}` }] };
        }
      } catch (err: any) {
        lastError = err.message ?? 'Unknown delivery error';
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return { success: false, records, errors: [{ record_index: -1, message: `Delivery failed after ${maxRetries + 1} attempts: ${lastError}` }] };
  }

  // ─── Utilities ──────────────────────────────────────────────────

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  // ─── Resume / Approve / Reject ──────────────────────────────────

  /**
   * Resume a transaction that is AWAITING_REVIEW (MANUAL mode).
   * Called after approval — continues execution from the step after NOTIFY.
   */
  async resumeTransaction(transactionId: string, tenantId: string): Promise<HubTransaction> {
    const transaction = await this.txDb.findFirst({
      where: { id: transactionId, tenant_id: tenantId, status: 'AWAITING_REVIEW' },
    });
    if (!transaction) {
      this.throwHttp(404, `Transaction ${transactionId} not found or not awaiting review`);
    }

    const pipeline = await (this.prisma as any).hubPipeline.findUnique({
      where: { id: transaction.pipeline_id },
      include: {
        steps: { where: { is_enabled: true }, orderBy: { step_order: 'asc' } },
        connection: true,
      },
    });
    if (!pipeline) {
      this.throwHttp(404, 'Pipeline not found');
    }

    // Find the NOTIFY step and get remaining steps after it
    const notifyIndex = pipeline.steps.findIndex((s: any) => s.step_type === 'NOTIFY');
    if (notifyIndex === -1) {
      this.throwHttp(400, 'No NOTIFY step found in pipeline');
    }

    const remainingSteps = pipeline.steps.slice(notifyIndex + 1) as HubPipelineStep[];
    let currentRecords = (transaction.mapped_payload ?? transaction.source_payload ?? []) as Record<string, unknown>[];
    let finalStatus: HubTransactionStatus = 'COMPLETED';
    let errorMessage: string | null = null;

    for (const step of remainingSteps) {
      const stepStatus = STEP_STATUS_MAP[step.step_type as HubStepType] ?? 'LOADING';
      await this.txDb.update({
        where: { id: transactionId },
        data: { status: stepStatus, current_step: step.name },
      });

      const stepStart = Date.now();
      let logStatus: HubStepLogStatus = 'STARTED';
      let stepErrorMsg: string | null = null;
      let stepResult: StepResult | null = null;

      try {
        stepResult = await this.executeWithTimeout(
          () => this.executeStep(step, currentRecords, transaction, pipeline),
          step.timeout_ms,
        );
        if (stepResult.success) {
          logStatus = 'COMPLETED';
          currentRecords = stepResult.records;
        } else {
          logStatus = 'FAILED';
          stepErrorMsg = stepResult.errors?.map(e => e.message).join('; ') ?? 'Step failed';
        }
      } catch (err: any) {
        logStatus = 'FAILED';
        stepErrorMsg = err.message;
      }

      await this.stepLogDb.create({
        data: {
          transaction_id: transactionId,
          step_type: step.step_type,
          step_name: step.name,
          step_order: step.step_order,
          status: logStatus,
          input_summary: { record_count: currentRecords.length } as any,
          output_summary: stepResult ? { record_count: stepResult.records.length } as any : null,
          error_message: stepErrorMsg,
          duration_ms: Date.now() - stepStart,
          started_at: new Date(stepStart),
          completed_at: new Date(),
        },
      });

      if (logStatus === 'FAILED') {
        finalStatus = 'FAILED';
        errorMessage = stepErrorMsg;
        break;
      }
    }

    await this.txDb.update({
      where: { id: transactionId },
      data: {
        status: finalStatus,
        current_step: null,
        target_payload: finalStatus === 'COMPLETED' ? (currentRecords as any) : null,
        error_message: errorMessage,
        completed_at: new Date(),
        duration_ms: Date.now() - new Date(transaction.started_at).getTime(),
      },
    });

    if (finalStatus === 'COMPLETED') {
      const topic = transaction.direction === 'INBOUND' ? TOPIC_AU_HUB_INBOUND_LOADED : TOPIC_AU_HUB_OUTBOUND_DELIVERED;
      await this.publishEvent(topic, transactionId, { transactionId, records: currentRecords.length }, tenantId);
    }

    return await this.txDb.findUnique({
      where: { id: transactionId },
      include: { records: true, steps_log: { orderBy: { step_order: 'asc' } } },
    }) as HubTransaction;
  }
}
