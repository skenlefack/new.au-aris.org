import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_FISHERIES_CAPTURE_RECORDED } from '../cross-domain/dto/cross-domain.dto';
import type { FishCapturePayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class FisheriesConsumer implements OnModuleInit {
  private readonly logger = new Logger(FisheriesConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_FISHERIES_CAPTURE_RECORDED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleFishCaptureRecorded(
            payload as FishCapturePayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_FISHERIES_CAPTURE_RECORDED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_FISHERIES_CAPTURE_RECORDED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
