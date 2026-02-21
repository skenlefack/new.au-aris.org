import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_WILDLIFE_CRIME_REPORTED } from '../cross-domain/dto/cross-domain.dto';
import type { WildlifeCrimePayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class WildlifeConsumer implements OnModuleInit {
  private readonly logger = new Logger(WildlifeConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_WILDLIFE_CRIME_REPORTED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleWildlifeCrimeReported(
            payload as WildlifeCrimePayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_WILDLIFE_CRIME_REPORTED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_WILDLIFE_CRIME_REPORTED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
