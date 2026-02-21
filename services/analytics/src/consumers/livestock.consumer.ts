import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_LIVESTOCK_CENSUS_CREATED } from '../cross-domain/dto/cross-domain.dto';
import type { LivestockCensusPayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class LivestockConsumer implements OnModuleInit {
  private readonly logger = new Logger(LivestockConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_LIVESTOCK_CENSUS_CREATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleLivestockCensusCreated(
            payload as LivestockCensusPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_LIVESTOCK_CENSUS_CREATED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_LIVESTOCK_CENSUS_CREATED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
