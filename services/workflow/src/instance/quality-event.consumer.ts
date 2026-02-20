import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_AU_QUALITY_RECORD_VALIDATED } from '@aris/shared-types';
import { WorkflowService } from './workflow.service';

const CONSUMER_GROUP = 'workflow-quality-consumer';

interface QualityValidatedPayload {
  reportId: string;
  recordId: string;
  entityType: string;
  domain: string;
  overallStatus: string;
}

@Injectable()
export class QualityEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(QualityEventConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly workflowService: WorkflowService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_AU_QUALITY_RECORD_VALIDATED,
          groupId: CONSUMER_GROUP,
        },
        async (payload) => {
          await this.handleQualityValidated(payload as { value: string | Buffer | null });
        },
      );
      this.logger.log(
        `Subscribed to ${TOPIC_AU_QUALITY_RECORD_VALIDATED} (group: ${CONSUMER_GROUP})`,
      );
    } catch (error) {
      this.logger.warn(
        `Kafka consumer not available — quality auto-advance disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleQualityValidated(message: { value: string | Buffer | null }): Promise<void> {
    if (!message.value) return;

    try {
      const payload: QualityValidatedPayload = JSON.parse(
        typeof message.value === 'string' ? message.value : message.value.toString(),
      );

      if (payload.overallStatus !== 'PASSED' && payload.overallStatus !== 'WARNING') {
        this.logger.debug(
          `Quality status ${payload.overallStatus} for ${payload.recordId} — skipping auto-advance`,
        );
        return;
      }

      await this.workflowService.autoAdvanceLevel1(
        payload.recordId,
        payload.reportId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process quality validated event`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
