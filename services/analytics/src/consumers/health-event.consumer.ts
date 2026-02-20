import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import {
  TOPIC_MS_HEALTH_EVENT_CREATED,
  TOPIC_MS_HEALTH_EVENT_CONFIRMED,
} from '@aris/shared-types';
import { AggregationService } from '../aggregation/aggregation.service';
import type { HealthEventPayload } from '../aggregation/aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class HealthEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(HealthEventConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly aggregation: AggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribeCreated();
    await this.subscribeConfirmed();
  }

  private async subscribeCreated(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_HEALTH_EVENT_CREATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleHealthEventCreated(
            payload as HealthEventPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_HEALTH_EVENT_CREATED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_HEALTH_EVENT_CREATED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async subscribeConfirmed(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_HEALTH_EVENT_CONFIRMED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleHealthEventConfirmed(
            payload as HealthEventPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_HEALTH_EVENT_CONFIRMED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_HEALTH_EVENT_CONFIRMED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
