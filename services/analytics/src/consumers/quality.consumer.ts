import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import {
  TOPIC_AU_QUALITY_RECORD_VALIDATED,
  TOPIC_AU_QUALITY_RECORD_REJECTED,
} from '@aris/shared-types';
import { AggregationService } from '../aggregation/aggregation.service';
import type { QualityRecordPayload } from '../aggregation/aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class QualityConsumer implements OnModuleInit {
  private readonly logger = new Logger(QualityConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly aggregation: AggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribeValidated();
    await this.subscribeRejected();
  }

  private async subscribeValidated(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_AU_QUALITY_RECORD_VALIDATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleQualityValidated(
            payload as QualityRecordPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_AU_QUALITY_RECORD_VALIDATED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_AU_QUALITY_RECORD_VALIDATED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async subscribeRejected(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_AU_QUALITY_RECORD_REJECTED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleQualityRejected(
            payload as QualityRecordPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_AU_QUALITY_RECORD_REJECTED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_AU_QUALITY_RECORD_REJECTED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
