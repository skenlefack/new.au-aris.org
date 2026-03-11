import type { PrismaClient } from '@prisma/client';
import { StandaloneKafkaConsumer } from '@aris/kafka-client';
import {
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
} from '@aris/shared-types';

/**
 * Kafka consumer that handles workflow flag-ready events.
 *
 * Replaces the synchronous REST PATCH from workflow-service -> animal-health.
 * When workflow approves at Level 2 (WAHIS) or Level 4 (analytics),
 * this consumer updates the local health event entity.
 */
export class WorkflowFlagConsumer {
  private consumer: StandaloneKafkaConsumer | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  async start(): Promise<void> {
    const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');

    this.consumer = new StandaloneKafkaConsumer({
      clientId: 'aris-animal-health-workflow-consumer',
      brokers,
    });

    try {
      await this.consumer.subscribe(
        {
          topic: TOPIC_AU_WORKFLOW_WAHIS_READY,
          groupId: 'animal-health-wahis-ready-consumer',
        },
        async (payload) => {
          await this.handleWahisReady(payload as WahisReadyPayload);
        },
      );

      await this.consumer.subscribe(
        {
          topic: TOPIC_AU_WORKFLOW_ANALYTICS_READY,
          groupId: 'animal-health-analytics-ready-consumer',
        },
        async (payload) => {
          await this.handleAnalyticsReady(payload as AnalyticsReadyPayload);
        },
      );

      console.log('Subscribed to workflow WAHIS ready and analytics ready events');
    } catch (error) {
      console.warn(
        `Kafka consumers not available -- workflow flag updates disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }

  private async handleWahisReady(event: WahisReadyPayload): Promise<void> {
    const { entityType, entityId, domain } = event.payload ?? event;

    // Only handle animal-health domain entities
    if (domain !== 'health' && domain !== 'animal-health') return;

    console.log(`Setting wahisReady=true for ${entityType}/${entityId}`);

    try {
      await this.updateEntityFlag(entityId!, { wahisReady: true });
    } catch (error) {
      console.error(
        `Failed to set wahisReady for ${entityType}/${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleAnalyticsReady(event: AnalyticsReadyPayload): Promise<void> {
    const { entityType, entityId, domain } = event.payload ?? event;

    // Only handle animal-health domain entities
    if (domain !== 'health' && domain !== 'animal-health') return;

    console.log(`Setting analyticsReady=true for ${entityType}/${entityId}`);

    try {
      await this.updateEntityFlag(entityId!, { analyticsReady: true });
    } catch (error) {
      console.error(
        `Failed to set analyticsReady for ${entityType}/${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async updateEntityFlag(
    entityId: string,
    flags: { wahisReady?: boolean; analyticsReady?: boolean },
  ): Promise<void> {
    await this.prisma.healthEvent.update({
      where: { id: entityId },
      data: flags,
    });
  }
}

interface WorkflowEventPayload {
  entityType: string;
  entityId: string;
  domain: string;
}

interface WahisReadyPayload {
  payload?: WorkflowEventPayload;
  entityType?: string;
  entityId?: string;
  domain?: string;
}

interface AnalyticsReadyPayload {
  payload?: WorkflowEventPayload;
  entityType?: string;
  entityId?: string;
  domain?: string;
}
