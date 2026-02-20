import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '@aris/kafka-client';
import { TOPIC_MS_HEALTH_EVENT_CREATED } from '@aris/shared-types';
import { HealthKpiService } from './health-kpi.service';

const CONSUMER_GROUP = 'analytics-health-consumer';

@Injectable()
export class HealthEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(HealthEventConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly healthKpiService: HealthKpiService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaConsumer.subscribe(
        {
          topic: TOPIC_MS_HEALTH_EVENT_CREATED,
          groupId: CONSUMER_GROUP,
          fromBeginning: false,
        },
        async (payload) => {
          await this.healthKpiService.handleHealthEventCreated(
            payload as Record<string, unknown>,
          );
        },
      );
      this.logger.log(
        `Subscribed to ${TOPIC_MS_HEALTH_EVENT_CREATED} (group: ${CONSUMER_GROUP})`,
      );
    } catch (error) {
      this.logger.warn(
        `Kafka consumer subscription failed — service will serve cached KPIs only. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
