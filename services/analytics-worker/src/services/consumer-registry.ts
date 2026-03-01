import type { FastifyInstance } from 'fastify';
import type { AnalyticsWorkerService } from './analytics-worker.service';
import {
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_UPDATED,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
} from '@aris/shared-types';

const GROUP_PREFIX = 'analytics-worker';

interface ConsumerDef {
  topics: string[];
  groupId: string;
  domain: string;
  extractEventType: (topic: string) => string;
}

// ── 5 Consumer Groups ──
const CONSUMERS: ConsumerDef[] = [
  {
    topics: [TOPIC_MS_HEALTH_EVENT_CREATED, TOPIC_MS_HEALTH_EVENT_UPDATED],
    groupId: `${GROUP_PREFIX}-health`,
    domain: 'health',
    extractEventType: (topic) => {
      if (topic.includes('created')) return 'health_event_created';
      return 'health_event_updated';
    },
  },
  {
    topics: [TOPIC_MS_COLLECTE_FORM_SUBMITTED],
    groupId: `${GROUP_PREFIX}-collecte`,
    domain: 'collecte',
    extractEventType: () => 'submission_received',
  },
  {
    topics: [TOPIC_AU_QUALITY_RECORD_VALIDATED, TOPIC_AU_QUALITY_RECORD_REJECTED],
    groupId: `${GROUP_PREFIX}-quality`,
    domain: 'quality',
    extractEventType: (topic) => {
      if (topic.includes('validated')) return 'record_validated';
      return 'record_rejected';
    },
  },
  {
    // Livestock census — uses the same health topic pattern but for livestock domain
    topics: ['ms.livestock.census.created.v1'],
    groupId: `${GROUP_PREFIX}-livestock`,
    domain: 'livestock',
    extractEventType: () => 'census_created',
  },
  {
    // Trade transactions
    topics: ['ms.trade.flow.created.v1'],
    groupId: `${GROUP_PREFIX}-trade`,
    domain: 'trade',
    extractEventType: () => 'trade_flow_created',
  },
];

export async function registerConsumers(
  app: FastifyInstance,
  analyticsService: AnalyticsWorkerService,
): Promise<void> {
  for (const consumer of CONSUMERS) {
    for (const topic of consumer.topics) {
      try {
        await app.kafka.subscribe(
          {
            topic,
            groupId: consumer.groupId,
            fromBeginning: false,
          },
          async (payload, headers, raw) => {
            const tenantId = headers['tenantId'] ?? 'unknown';
            const eventType = consumer.extractEventType(topic);

            try {
              await analyticsService.processEvent(
                consumer.domain,
                eventType,
                (payload as Record<string, unknown>) ?? {},
                tenantId,
              );

              // Track worker state
              const partition = 0; // StandaloneKafkaConsumer commits per partition
              await analyticsService.saveWorkerState(
                consumer.groupId,
                topic,
                partition,
                raw.offset,
              );

              app.log.debug(
                { topic, domain: consumer.domain, tenantId, eventType },
                'Processed domain event',
              );
            } catch (error) {
              app.log.error({ topic, error }, 'Failed to process event');
              await analyticsService.recordWorkerError(
                consumer.groupId,
                topic,
                0,
                error instanceof Error ? error.message : String(error),
              );
            }
          },
        );
        app.log.info(`Subscribed to ${topic} in group ${consumer.groupId}`);
      } catch (err) {
        app.log.warn(`Failed to subscribe to ${topic}: ${err}`);
      }
    }
  }
}
