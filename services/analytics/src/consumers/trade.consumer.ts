import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_TRADE_FLOW_CREATED } from '../cross-domain/dto/cross-domain.dto';
import type { TradeFlowPayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class TradeConsumer implements OnModuleInit {
  private readonly logger = new Logger(TradeConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_TRADE_FLOW_CREATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleTradeFlowCreated(
            payload as TradeFlowPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_TRADE_FLOW_CREATED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_TRADE_FLOW_CREATED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
