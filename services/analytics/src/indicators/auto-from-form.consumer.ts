/**
 * auto-from-form.consumer.ts — Kafka consumer that auto-populates indicator values
 * from form submissions.
 *
 * Listens to `ms.collecte.form.submitted.v1`. When a form submission arrives:
 *   1. Finds AUTO_FROM_FORM indicators that reference the submitted form (sourceFormId)
 *   2. Aggregates the field value(s) from the submission according to the indicator's aggregation setting
 *   3. Upserts the value into indicator_values
 *   4. Publishes `sys.analytics.indicator.value-updated.v1` so composite indicators can cascade
 */

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED,
} from '@aris/shared-types';

const CONSUMER_GROUP = 'analytics-auto-from-form';

/** Shape of the Kafka payload coming from the collecte service */
interface FormSubmittedPayload {
  submissionId: string;
  formTemplateId: string;
  campaignId?: string;
  tenantId: string;
  countryCode?: string;
  recCode?: string;
  /** The actual form field values — key/value pairs */
  data: Record<string, unknown>;
  submittedAt?: string;
  submittedBy?: string;
}

/** Row shape for an AUTO_FROM_FORM indicator */
interface AutoIndicatorRow {
  id: string;
  code: string;
  source_form_id: string;
  source_form_field_id: string | null;
  aggregation: string;
  periodicity: string;
}

export async function registerAutoFromFormConsumer(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  try {
    await (app as any).kafka.subscribe(
      { topic: TOPIC_MS_COLLECTE_FORM_SUBMITTED, groupId: CONSUMER_GROUP, fromBeginning: false },
      async (payload: any) => {
        await handleFormSubmitted(app, pool, payload as FormSubmittedPayload);
      },
    );
    app.log.info(`[AutoFromForm] Subscribed to ${TOPIC_MS_COLLECTE_FORM_SUBMITTED}`);
  } catch (err) {
    app.log.warn(`[AutoFromForm] Failed to subscribe to ${TOPIC_MS_COLLECTE_FORM_SUBMITTED}: ${err}`);
  }
}

async function handleFormSubmitted(
  app: FastifyInstance,
  pool: Pool,
  payload: FormSubmittedPayload,
): Promise<void> {
  const { formTemplateId, data, countryCode, recCode, submittedBy } = payload;

  if (!formTemplateId || !data) {
    app.log.warn('[AutoFromForm] Missing formTemplateId or data in payload, skipping');
    return;
  }

  // 1. Find all AUTO_FROM_FORM indicators that reference this form
  const { rows: indicators } = await pool.query<AutoIndicatorRow>(
    `SELECT id, code, source_form_id, source_form_field_id, aggregation, periodicity
     FROM analytics.indicators
     WHERE measurement_mode = 'AUTO_FROM_FORM'
       AND source_form_id = $1
       AND active = true`,
    [formTemplateId],
  );

  if (indicators.length === 0) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  for (const indicator of indicators) {
    try {
      // 2. Extract the field value from submission data
      const fieldId = indicator.source_form_field_id;
      if (!fieldId) {
        app.log.warn(`[AutoFromForm] Indicator ${indicator.code} has no source_form_field_id, skipping`);
        continue;
      }

      const rawValue = extractFieldValue(data, fieldId);
      if (rawValue === null) {
        app.log.debug(`[AutoFromForm] Field ${fieldId} not found in submission for indicator ${indicator.code}`);
        continue;
      }

      // 3. Determine the time dimensions based on periodicity
      const timeDims = resolveTimeDimensions(indicator.periodicity, year, month, quarter);

      // 4. Aggregate: fetch existing value and apply aggregation
      const newValue = await aggregateValue(
        pool,
        indicator.id,
        indicator.aggregation,
        rawValue,
        timeDims,
        countryCode,
        recCode,
      );

      // 5. Upsert the indicator value
      const valueId = randomUUID();
      const { rows: upserted } = await pool.query(
        `INSERT INTO analytics.indicator_values
          (id, indicator_id, year, month, quarter, country_code, rec_code, is_continental, value, source, entered_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, 'AUTO_FROM_FORM', $9)
         ON CONFLICT ON CONSTRAINT uq_indicator_value
         DO UPDATE SET value = $8, source = 'AUTO_FROM_FORM', updated_at = NOW()
         RETURNING *`,
        [
          valueId,
          indicator.id,
          timeDims.year,
          timeDims.month,
          timeDims.quarter,
          countryCode ?? null,
          recCode ?? null,
          newValue,
          submittedBy ?? null,
        ],
      );

      // 6. Publish value-updated event for composite cascade
      await publishWithTimeout(app, TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED, indicator.id, {
        indicatorId: indicator.id,
        indicatorCode: indicator.code,
        year: timeDims.year,
        month: timeDims.month,
        quarter: timeDims.quarter,
        countryCode: countryCode ?? null,
        recCode: recCode ?? null,
        value: newValue,
        source: 'AUTO_FROM_FORM',
        depth: 0,
        ...upserted[0],
      });

      app.log.info(
        `[AutoFromForm] Updated indicator ${indicator.code} = ${newValue} (year=${timeDims.year}, country=${countryCode ?? 'N/A'})`,
      );
    } catch (err) {
      app.log.error(`[AutoFromForm] Error processing indicator ${indicator.code}: ${err}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract a numeric value from nested form data using dot-notation field IDs.
 */
function extractFieldValue(data: Record<string, unknown>, fieldId: string): number | null {
  const parts = fieldId.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) return null;
  const num = Number(current);
  return isNaN(num) ? null : num;
}

/**
 * Resolve which time dimensions to use for the upsert based on periodicity.
 */
function resolveTimeDimensions(
  periodicity: string,
  year: number,
  month: number,
  quarter: number,
): { year: number; month: number | null; quarter: number | null } {
  switch (periodicity) {
    case 'DAILY':
    case 'WEEKLY':
    case 'MONTHLY':
      return { year, month, quarter: null };
    case 'QUARTERLY':
      return { year, month: null, quarter };
    case 'ANNUAL':
    case 'ON_DEMAND':
    default:
      return { year, month: null, quarter: null };
  }
}

/**
 * Apply the aggregation function to compute the new value.
 * For SUM: adds incoming value to existing.
 * For COUNT: increments by 1.
 * For AVERAGE: maintains running average via a Redis counter (simplified: stores latest).
 * For LATEST: just overwrites.
 * For MIN/MAX: compares with existing.
 */
async function aggregateValue(
  pool: Pool,
  indicatorId: string,
  aggregation: string,
  incomingValue: number,
  timeDims: { year: number; month: number | null; quarter: number | null },
  countryCode?: string,
  recCode?: string,
): Promise<number> {
  // Fetch existing value for this dimension
  const conditions: string[] = [
    'indicator_id = $1',
    'year = $2',
  ];
  const params: unknown[] = [indicatorId, timeDims.year];
  let idx = 3;

  if (timeDims.month !== null) {
    conditions.push(`month = $${idx++}`);
    params.push(timeDims.month);
  } else {
    conditions.push('month IS NULL');
  }

  if (timeDims.quarter !== null) {
    conditions.push(`quarter = $${idx++}`);
    params.push(timeDims.quarter);
  } else {
    conditions.push('quarter IS NULL');
  }

  if (countryCode) {
    conditions.push(`country_code = $${idx++}`);
    params.push(countryCode);
  } else {
    conditions.push('country_code IS NULL');
  }

  if (recCode) {
    conditions.push(`rec_code = $${idx++}`);
    params.push(recCode);
  } else {
    conditions.push('rec_code IS NULL');
  }

  const { rows: existing } = await pool.query(
    `SELECT value FROM analytics.indicator_values WHERE ${conditions.join(' AND ')} LIMIT 1`,
    params,
  );

  const currentValue = existing.length > 0 ? existing[0].value : null;

  switch (aggregation) {
    case 'SUM':
      return (currentValue ?? 0) + incomingValue;
    case 'COUNT':
      return (currentValue ?? 0) + 1;
    case 'AVERAGE':
      // Simplified: running average = (old + new) / 2 when old exists
      return currentValue !== null ? (currentValue + incomingValue) / 2 : incomingValue;
    case 'MIN':
      return currentValue !== null ? Math.min(currentValue, incomingValue) : incomingValue;
    case 'MAX':
      return currentValue !== null ? Math.max(currentValue, incomingValue) : incomingValue;
    case 'LATEST':
    default:
      return incomingValue;
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
        source: 'analytics-auto-from-form',
        correlationId: randomUUID(),
      } as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Kafka publish timeout')), 5_000),
      ),
    ]);
  } catch (err) {
    app.log.warn(`[AutoFromForm] Kafka publish to ${topic} failed: ${err}`);
  }
}
