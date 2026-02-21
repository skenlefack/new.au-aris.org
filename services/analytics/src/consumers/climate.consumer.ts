import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_CLIMATE_HOTSPOT_DETECTED } from '../cross-domain/dto/cross-domain.dto';
import type { ClimateHotspotPayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class ClimateConsumer implements OnModuleInit {
  private readonly logger = new Logger(ClimateConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_CLIMATE_HOTSPOT_DETECTED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleClimateHotspotDetected(
            payload as ClimateHotspotPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_CLIMATE_HOTSPOT_DETECTED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_CLIMATE_HOTSPOT_DETECTED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
