/**
 * Runs the tenant's ACTIVE + AUTOMATIC + OUTBOUND pipelines for an incoming
 * Kafka event (WAHIS-ready, analytics-ready, form submitted).
 *
 * One failing pipeline never stops the others, and this function never throws,
 * so a bad pipeline can't crash the Kafka consumer.
 */
import type { PipelineEngineService } from './pipeline-engine.service';
import type { HubLogger } from './types';

interface PipelineFinder {
  hubPipeline: {
    findMany(args: { where: Record<string, unknown> }): Promise<Array<{ id: string; created_by: string }>>;
  };
}

export interface OutboundTriggerResult {
  executed: string[];
  failed: string[];
}

export async function triggerOutboundPipelines(
  prisma: PipelineFinder,
  engine: Pick<PipelineEngineService, 'executePipeline'>,
  logger: HubLogger,
  tenantId: string,
  data: Record<string, unknown>,
  filter: Record<string, unknown> = {},
): Promise<OutboundTriggerResult> {
  const result: OutboundTriggerResult = { executed: [], failed: [] };

  let pipelines: Array<{ id: string; created_by: string }>;
  try {
    pipelines = await prisma.hubPipeline.findMany({
      where: {
        ...filter,
        tenant_id: tenantId,
        direction: 'OUTBOUND',
        status: 'ACTIVE',
        mode: 'AUTOMATIC',
      },
    });
  } catch (err) {
    logger.error(`Outbound pipeline lookup failed for tenant=${tenantId}: ${err}`);
    return result;
  }

  const records = Array.isArray(data.records)
    ? (data.records as Record<string, unknown>[])
    : [data];

  for (const pipeline of pipelines) {
    try {
      await engine.executePipeline(pipeline.id, { records }, pipeline.created_by);
      result.executed.push(pipeline.id);
      logger.info(`Executed outbound pipeline=${pipeline.id}`);
    } catch (err) {
      result.failed.push(pipeline.id);
      logger.error(`Pipeline ${pipeline.id} execution failed: ${err}`);
    }
  }

  return result;
}
