import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_HEALTH_LAB_RESULT_CREATED } from '@aris/shared-types';
import { AggregationService } from '../aggregation/aggregation.service';
import type { LabResultPayload } from '../aggregation/aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class LabResultConsumer implements OnModuleInit {
  private readonly logger = new Logger(LabResultConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly aggregation: AggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleLabResultCreated(
            payload as LabResultPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_HEALTH_LAB_RESULT_CREATED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_HEALTH_LAB_RESULT_CREATED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
