/**
 * composite-recompute.consumer.ts — Kafka consumer that cascades recomputation
 * of composite (formula-based) indicators when their dependencies update.
 *
 * Listens to `sys.analytics.indicator.value-updated.v1`.
 * For each event:
 *   1. Finds formulas that depend on the updated indicator
 *   2. Evaluates the formula via FormulaEvaluator
 *   3. Upserts the composite indicator value
 *   4. Re-publishes the event for further cascade (max depth = 5 to prevent infinite loops)
 */

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED,
  TOPIC_SYS_ANALYTICS_INDICATOR_COMPUTE_FAILED,
} from '@aris/shared-types';
import type { FormulaEvaluator } from './formula-evaluator';

const CONSUMER_GROUP = 'analytics-composite-recompute';
const MAX_CASCADE_DEPTH = 5;

/** Shape of the indicator.value.updated event */
interface IndicatorValueUpdatedPayload {
  indicatorId: string;
  indicatorCode?: string;
  year: number;
  month?: number | null;
  quarter?: number | null;
  countryCode?: string | null;
  recCode?: string | null;
  value: number;
  source?: string;
  /** Cascade depth counter — incremented on each re-publish */
  depth?: number;
}

/** Row shape for a dependent composite indicator */
interface DependentRow {
  indicator_id: string;
  indicator_code: string;
  formula_id: string;
}

export async function registerCompositeRecomputeConsumer(
  app: FastifyInstance,
  pool: Pool,
  formulaEvaluator: FormulaEvaluator,
): Promise<void> {
  try {
    await app.kafka.subscribe(
      { topic: TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload) => {
        await handleValueUpdated(app, pool, formulaEvaluator, payload as IndicatorValueUpdatedPayload);
      },
    );
    app.log.info(`[CompositeRecompute] Subscribed to ${TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED}`);
  } catch (err) {
    app.log.warn(`[CompositeRecompute] Failed to subscribe to ${TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED}: ${err}`);
  }
}

async function handleValueUpdated(
  app: FastifyInstance,
  pool: Pool,
  formulaEvaluator: FormulaEvaluator,
  payload: IndicatorValueUpdatedPayload,
): Promise<void> {
  const { indicatorId, year, countryCode, depth = 0 } = payload;

  // Anti-loop protection
  if (depth >= MAX_CASCADE_DEPTH) {
    app.log.warn(
      `[CompositeRecompute] Max cascade depth (${MAX_CASCADE_DEPTH}) reached for indicator ${indicatorId}, stopping`,
    );
    return;
  }

  if (!indicatorId || !year) {
    app.log.warn('[CompositeRecompute] Missing indicatorId or year in payload, skipping');
    return;
  }

  // 1. Find all composite indicators that depend on the updated indicator
  const { rows: dependents } = await pool.query<DependentRow>(
    `SELECT DISTINCT
       i.id AS indicator_id,
       i.code AS indicator_code,
       f.id AS formula_id
     FROM analytics.indicator_formula_dependencies d
     JOIN analytics.indicator_formulas f ON f.id = d.formula_id
     JOIN analytics.indicators i ON i.id = f.indicator_id
     WHERE d.referenced_indicator_id = $1
       AND i.active = true
       AND i.measurement_mode = 'COMPOSITE_FORMULA'`,
    [indicatorId],
  );

  if (dependents.length === 0) return;

  app.log.info(
    `[CompositeRecompute] Indicator ${indicatorId} updated -> recomputing ${dependents.length} dependent(s) (depth=${depth})`,
  );

  for (const dep of dependents) {
    try {
      // 2. Evaluate the formula
      const result = await formulaEvaluator.evaluate(
        dep.indicator_id,
        year,
        countryCode ?? undefined,
      );

      if (result.value === null) {
        app.log.warn(
          `[CompositeRecompute] Formula evaluation returned null for ${dep.indicator_code}: ${result.errors.join(', ')}`,
        );

        // Publish compute-failed event
        await publishWithTimeout(app, TOPIC_SYS_ANALYTICS_INDICATOR_COMPUTE_FAILED, dep.indicator_id, {
          indicatorId: dep.indicator_id,
          indicatorCode: dep.indicator_code,
          year,
          countryCode: countryCode ?? null,
          errors: result.errors,
          depth,
        });
        continue;
      }

      // 3. Determine time dimensions from the triggering event
      const month = payload.month ?? null;
      const quarter = payload.quarter ?? null;

      // 4. Upsert the composite value
      const valueId = randomUUID();
      const { rows: upserted } = await pool.query(
        `INSERT INTO analytics.indicator_values
          (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, 'COMPOSITE_FORMULA')
         ON CONFLICT ON CONSTRAINT uq_indicator_value
         DO UPDATE SET value = $8, source = 'COMPOSITE_FORMULA', updated_at = NOW()
         RETURNING *`,
        [
          valueId,
          dep.indicator_id,
          year,
          month,
          quarter,
          countryCode ?? null,
          payload.recCode ?? null,
          result.value,
        ],
      );

      app.log.info(
        `[CompositeRecompute] Recomputed ${dep.indicator_code} = ${result.value} (year=${year}, depth=${depth + 1})`,
      );

      // 5. Re-publish for further cascade (depth + 1)
      await publishWithTimeout(app, TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED, dep.indicator_id, {
        indicatorId: dep.indicator_id,
        indicatorCode: dep.indicator_code,
        year,
        month,
        quarter,
        countryCode: countryCode ?? null,
        recCode: payload.recCode ?? null,
        value: result.value,
        source: 'COMPOSITE_FORMULA',
        depth: depth + 1,
        ...upserted[0],
      });
    } catch (err) {
      app.log.error(`[CompositeRecompute] Error recomputing ${dep.indicator_code}: ${err}`);
    }
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
      app.kafka.send(topic, key, payload, {
        source: 'analytics-composite-recompute',
        correlationId: randomUUID(),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka publish timeout')), 5_000),
      ),
    ]);
  } catch (err) {
    app.log.warn(`[CompositeRecompute] Kafka publish to ${topic} failed: ${err}`);
  }
}
