/**
 * auto-from-kpi.consumer.ts — Kafka consumer that auto-populates indicator values
 * from KPI score updates.
 *
 * Listens to `sys.analytics.kpi.score-updated.v1`. When a KPI score update arrives:
 *   1. Finds AUTO_FROM_KPI_SOURCE indicators that reference the kpiCode
 *   2. Upserts the value into indicator_values
 *   3. Publishes `sys.analytics.indicator.value-updated.v1` so composite indicators can cascade
 */

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  TOPIC_SYS_ANALYTICS_KPI_SCORE_UPDATED,
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED,
} from '@aris/shared-types';

const CONSUMER_GROUP = 'analytics-auto-from-kpi';

/** Shape of the Kafka payload from the KPI scoring pipeline */
interface KpiScoreUpdatedPayload {
  kpiDefinitionId: string;
  kpiCode: string;
  countryCode?: string;
  recCode?: string;
  year: number;
  month?: number | null;
  quarter?: number | null;
  score: number;
  updatedBy?: string;
}

/** Row shape for an AUTO_FROM_KPI_SOURCE indicator */
interface AutoKpiIndicatorRow {
  id: string;
  code: string;
  source_kpi_code: string;
  periodicity: string;
}

export async function registerAutoFromKpiConsumer(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  try {
    await (app as any).kafka.subscribe(
      { topic: TOPIC_SYS_ANALYTICS_KPI_SCORE_UPDATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload: any) => {
        await handleKpiScoreUpdated(app, pool, payload as KpiScoreUpdatedPayload);
      },
    );
    app.log.info(`[AutoFromKpi] Subscribed to ${TOPIC_SYS_ANALYTICS_KPI_SCORE_UPDATED}`);
  } catch (err) {
    app.log.warn(`[AutoFromKpi] Failed to subscribe to ${TOPIC_SYS_ANALYTICS_KPI_SCORE_UPDATED}: ${err}`);
  }
}

async function handleKpiScoreUpdated(
  app: FastifyInstance,
  pool: Pool,
  payload: KpiScoreUpdatedPayload,
): Promise<void> {
  const { kpiCode, score, countryCode, recCode, year, month, quarter, updatedBy } = payload;

  if (!kpiCode || score === undefined || score === null) {
    app.log.warn('[AutoFromKpi] Missing kpiCode or score in payload, skipping');
    return;
  }

  // 1. Find all AUTO_FROM_KPI_SOURCE indicators that reference this kpiCode
  const { rows: indicators } = await pool.query<AutoKpiIndicatorRow>(
    `SELECT id, code, source_kpi_code, periodicity
     FROM analytics.indicators
     WHERE measurement_mode = 'AUTO_FROM_KPI_SOURCE'
       AND source_kpi_code = $1
       AND active = true`,
    [kpiCode],
  );

  if (indicators.length === 0) return;

  for (const indicator of indicators) {
    try {
      // 2. Determine the time dimensions based on periodicity
      const timeDims = resolveTimeDimensions(indicator.periodicity, year, month ?? null, quarter ?? null);

      // 3. Upsert the indicator value
      const valueId = randomUUID();
      const { rows: upserted } = await pool.query(
        `INSERT INTO analytics.indicator_values
          (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, entered_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, 'AUTO_FROM_KPI_SOURCE', $9)
         ON CONFLICT ON CONSTRAINT uq_indicator_value
         DO UPDATE SET value = $8, source = 'AUTO_FROM_KPI_SOURCE', updated_at = NOW()
         RETURNING *`,
        [
          valueId,
          indicator.id,
          timeDims.year,
          timeDims.month,
          timeDims.quarter,
          countryCode ?? null,
          recCode ?? null,
          score,
          updatedBy ?? null,
        ],
      );

      // 4. Publish value-updated event for composite cascade
      await publishWithTimeout(app, TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED, indicator.id, {
        indicatorId: indicator.id,
        indicatorCode: indicator.code,
        year: timeDims.year,
        month: timeDims.month,
        quarter: timeDims.quarter,
        countryCode: countryCode ?? null,
        recCode: recCode ?? null,
        value: score,
        source: 'AUTO_FROM_KPI_SOURCE',
        depth: 0,
        ...upserted[0],
      });

      app.log.info(
        `[AutoFromKpi] Updated indicator ${indicator.code} = ${score} from KPI ${kpiCode} (year=${timeDims.year}, country=${countryCode ?? 'N/A'})`,
      );
    } catch (err) {
      app.log.error(`[AutoFromKpi] Error processing indicator ${indicator.code}: ${err}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve which time dimensions to use for the upsert based on periodicity.
 * Uses the payload's year/month/quarter, falling back to periodicity-based defaults.
 */
function resolveTimeDimensions(
  periodicity: string,
  year: number,
  month: number | null,
  quarter: number | null,
): { year: number; month: number | null; quarter: number | null } {
  switch (periodicity) {
    case 'DAILY':
    case 'WEEKLY':
    case 'MONTHLY':
      return { year, month: month ?? (new Date().getMonth() + 1), quarter: null };
    case 'QUARTERLY':
      return { year, month: null, quarter: quarter ?? Math.ceil((new Date().getMonth() + 1) / 3) };
    case 'ANNUAL':
    case 'ON_DEMAND':
    default:
      return { year, month: null, quarter: null };
  }
}

/**
 * Publish a Kafka event with a 5s timeout (feedback_kafka_timeout_pattern).
 */
async function publishWithTimeout(
  app: FastifyInstance,
  topic: string,
  key: string,
  payload: unknown,
): Promise<void> {
  try {
    await Promise.race([
      (app as any).kafka.send(topic, key, payload, {
        source: 'analytics-auto-from-kpi',
        correlationId: randomUUID(),
      } as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka publish timeout')), 5_000),
      ),
    ]);
  } catch (err) {
    app.log.warn(`[AutoFromKpi] Kafka publish to ${topic} failed: ${err}`);
  }
}
