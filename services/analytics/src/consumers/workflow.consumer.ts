import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_AU_WORKFLOW_VALIDATION_APPROVED } from '@aris/shared-types';
import { AggregationService } from '../aggregation/aggregation.service';
import type { WorkflowApprovedPayload } from '../aggregation/aggregation.service';

const CONSUMER_GROUP = 'analytics-aggregator';

@Injectable()
export class WorkflowConsumer implements OnModuleInit {
  private readonly logger = new Logger(WorkflowConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly aggregation: AggregationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.aggregation.handleWorkflowApproved(
            payload as WorkflowApprovedPayload,
          );
        },
      );
      this.logger.log(`Subscribed to ${TOPIC_AU_WORKFLOW_VALIDATION_APPROVED}`);
    } catch (error) {
      this.logger.warn(
        `Failed to subscribe to ${TOPIC_AU_WORKFLOW_VALIDATION_APPROVED}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
