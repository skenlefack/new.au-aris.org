/**
 * flash-detector.ts — Kafka consumer that detects flash alert conditions.
 *
 * Listens to indicator.value events, evaluates active FlashStrategy rules,
 * and triggers flash report generation when conditions are met.
 * Throttling via cooldownMinutes per strategy.
 */

import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_CREATED,
  TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED,
  TOPIC_SYS_ANALYTICS_FLASH_ALERT_CREATED,
} from '@aris/shared-types';

const KAFKA_TIMEOUT_MS = 5_000;

interface FlashStrategy {
  id: string;
  code: string;
  name_fr: string;
  name_en: string;
  domain_id: string | null;
  indicator_code: string;
  condition_type: string;
  condition_value: number;
  template_id: string;
  cooldown_minutes: number;
  active: boolean;
  last_triggered_at: string | null;
}

interface IndicatorValueEvent {
  indicatorId: string;
  indicatorCode: string;
  numericValue: number;
  previousValue?: number;
  tenantId: string;
  period: string;
}

export async function registerFlashDetectorConsumer(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  if (!app.kafka) {
    app.log.warn('[FlashDetector] Kafka not available, skipping consumer registration');
    return;
  }

  const topics = [
    TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_CREATED,
    TOPIC_SYS_ANALYTICS_INDICATOR_VALUE_UPDATED,
  ];

  try {
    await app.kafka.consumer.subscribe({ topics, fromBeginning: false });
    app.log.info(`[FlashDetector] Subscribed to ${topics.join(', ')}`);
  } catch (err) {
    app.log.warn(`[FlashDetector] Failed to subscribe: ${err}`);
    return;
  }

  await app.kafka.consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      try {
        const event = JSON.parse(message.value.toString()) as IndicatorValueEvent;
        await evaluateStrategies(app, pool, event);
      } catch (err) {
        app.log.error(`[FlashDetector] Error processing message: ${err}`);
      }
    },
  });
}

async function evaluateStrategies(
  app: FastifyInstance,
  pool: Pool,
  event: IndicatorValueEvent,
): Promise<void> {
  // Load active strategies matching this indicator
  const { rows: strategies } = await pool.query<FlashStrategy>(
    `SELECT * FROM reports.flash_strategies
     WHERE active = true AND indicator_code = $1`,
    [event.indicatorCode],
  );

  if (!strategies.length) return;

  for (const strategy of strategies) {
    // Check cooldown
    if (strategy.last_triggered_at) {
      const lastTriggered = new Date(strategy.last_triggered_at);
      const cooldownEnd = new Date(lastTriggered.getTime() + strategy.cooldown_minutes * 60_000);
      if (new Date() < cooldownEnd) {
        app.log.debug(`[FlashDetector] Strategy ${strategy.code} in cooldown, skipping`);
        continue;
      }
    }

    // Evaluate condition
    const triggered = evaluateCondition(
      strategy.condition_type,
      strategy.condition_value,
      event.numericValue,
      event.previousValue,
    );

    if (!triggered) continue;

    app.log.info(`[FlashDetector] Strategy ${strategy.code} triggered for indicator ${event.indicatorCode}`);

    // Create flash alert
    const alertId = randomUUID();
    await pool.query(
      `INSERT INTO reports.flash_alerts
         (id, strategy_id, indicator_code, trigger_value, threshold_value,
          condition_type, tenant_id, report_id, dismissed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, false, NOW(), NOW())`,
      [
        alertId, strategy.id, event.indicatorCode,
        event.numericValue, strategy.condition_value,
        strategy.condition_type, event.tenantId,
      ],
    );

    // Update last_triggered_at
    await pool.query(
      `UPDATE reports.flash_strategies SET last_triggered_at = NOW() WHERE id = $1`,
      [strategy.id],
    );

    // Trigger flash report generation if template is configured
    if (strategy.template_id && app.reportService) {
      try {
        const today = new Date().toISOString().split('T')[0]!;
        const report = await app.reportService.generateReport(
          {
            templateId: strategy.template_id,
            titleFr: `Alerte Flash — ${strategy.name_fr}`,
            titleEn: `Flash Alert — ${strategy.name_en}`,
            scope: 'CONTINENTAL',
            periodStart: today,
            periodEnd: today,
            language: 'en',
          },
          'system',
          event.tenantId,
        );

        // Link alert to report
        const reportId = (report as Record<string, unknown>)['id'];
        if (reportId) {
          await pool.query(
            `UPDATE reports.flash_alerts SET report_id = $1 WHERE id = $2`,
            [reportId, alertId],
          );
        }
      } catch (err) {
        app.log.error(`[FlashDetector] Failed to generate flash report: ${err}`);
      }
    }

    // Publish flash alert event
    if (app.kafka) {
      try {
        await Promise.race([
          app.kafka.producer.send({
            topic: TOPIC_SYS_ANALYTICS_FLASH_ALERT_CREATED,
            messages: [{
              key: alertId,
              value: JSON.stringify({
                alertId,
                strategyCode: strategy.code,
                indicatorCode: event.indicatorCode,
                triggerValue: event.numericValue,
                thresholdValue: strategy.condition_value,
                tenantId: event.tenantId,
                createdAt: new Date().toISOString(),
              }),
            }],
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Kafka timeout')), KAFKA_TIMEOUT_MS)),
        ]);
      } catch (err) {
        app.log.warn(`[FlashDetector] Failed to publish flash alert event: ${err}`);
      }
    }
  }
}

function evaluateCondition(
  conditionType: string,
  conditionValue: number,
  currentValue: number,
  previousValue?: number,
): boolean {
  switch (conditionType) {
    case 'THRESHOLD_ABOVE':
      return currentValue > conditionValue;

    case 'THRESHOLD_BELOW':
      return currentValue < conditionValue;

    case 'PERCENT_CHANGE': {
      if (previousValue === undefined || previousValue === 0) return false;
      const pctChange = Math.abs((currentValue - previousValue) / previousValue) * 100;
      return pctChange > conditionValue;
    }

    case 'ANOMALY': {
      // Simple anomaly: deviation from threshold (placeholder for statistical model)
      if (previousValue === undefined || previousValue === 0) return false;
      const deviation = Math.abs(currentValue - previousValue) / previousValue;
      return deviation > (conditionValue / 100);
    }

    default:
      return false;
  }
}
