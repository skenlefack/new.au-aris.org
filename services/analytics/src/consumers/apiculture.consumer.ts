import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_APICULTURE_PRODUCTION_RECORDED } from '../cross-domain/dto/cross-domain.dto';
import type { ApicultureProductionPayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class ApicultureConsumer implements OnModuleInit {
  private readonly logger = new Logger(ApicultureConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_APICULTURE_PRODUCTION_RECORDED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleApicultureProductionRecorded(
            payload as ApicultureProductionPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_APICULTURE_PRODUCTION_RECORDED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_APICULTURE_PRODUCTION_RECORDED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
