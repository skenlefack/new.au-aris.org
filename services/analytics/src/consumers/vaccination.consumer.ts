import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_HEALTH_VACCINATION_COMPLETED } from '@aris/shared-types';
import { AggregationService } from '../aggregation/aggregation.service';
import type { VaccinationPayload } from '../aggregation/aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class VaccinationConsumer implements OnModuleInit {
  private readonly logger = new Logger(VaccinationConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly aggregation: AggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleVaccinationCompleted(
            payload as VaccinationPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_HEALTH_VACCINATION_COMPLETED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_HEALTH_VACCINATION_COMPLETED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
