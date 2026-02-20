import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import {
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
} from '@aris/shared-types';

@Injectable()
export class InteropConsumer implements OnModuleInit {
  private readonly logger = new Logger(InteropConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribeToWahisReady();
    await this.subscribeToAnalyticsReady();
    this.logger.log('Interop consumer subscribed to Kafka topics');
  }

  /**
   * When a workflow instance becomes WAHIS-ready (Level 2 approved),
   * auto-queue a WAHIS export. In production this would trigger the
   * WahisService.createExport() with system credentials.
   */
  private async subscribeToWahisReady(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_WAHIS_READY, groupId: 'interop-hub-wahis-ready' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const instanceId = data.id ?? data.instanceId ?? data.instance_id;
          const tenantId = headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          this.logger.log(
            `WAHIS-ready event received: instance=${instanceId as string} tenant=${tenantId as string}`,
          );

          // In production: auto-queue WAHIS export for this instance's country/period
          // For now, log and acknowledge
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to WAHIS ready events',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * When a workflow instance becomes analytics-ready (Level 4 approved),
   * mark it as available for dashboard publication.
   */
  private async subscribeToAnalyticsReady(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        { topic: TOPIC_AU_WORKFLOW_ANALYTICS_READY, groupId: 'interop-hub-analytics-ready' },
        async (payload, headers) => {
          const data = payload as Record<string, unknown> | null;
          if (!data) return;

          const instanceId = data.id ?? data.instanceId ?? data.instance_id;
          const tenantId = headers['tenantId'] ?? (data.tenantId as string | undefined) ?? (data.tenant_id as string | undefined);

          this.logger.log(
            `Analytics-ready event received: instance=${instanceId as string} tenant=${tenantId as string}`,
          );

          // In production: trigger analytics pipeline / dashboard publication
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to analytics ready events',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
