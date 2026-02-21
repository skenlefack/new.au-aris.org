import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_GOVERNANCE_PVS_EVALUATED } from '../cross-domain/dto/cross-domain.dto';
import type { GovernancePvsPayload } from '../cross-domain/dto/cross-domain.dto';
import { DomainAggregationService } from '../domain-aggregation/domain-aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class GovernanceConsumer implements OnModuleInit {
  private readonly logger = new Logger(GovernanceConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly domainAggregation: DomainAggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_GOVERNANCE_PVS_EVALUATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.domainAggregation.handleGovernancePvsEvaluated(
            payload as GovernancePvsPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_MS_GOVERNANCE_PVS_EVALUATED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_MS_GOVERNANCE_PVS_EVALUATED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
