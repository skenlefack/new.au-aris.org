import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventConsumer, EVENTS } from '@aris/kafka-client';
import type {
  WorkflowWahisReadyEvent,
  WorkflowAnalyticsReadyEvent,
} from '@aris/kafka-client';
import { PrismaService } from '../prisma.service';

/**
 * Kafka consumer that handles workflow flag-ready events.
 *
 * Replaces the synchronous REST PATCH from workflow-service → animal-health.
 * When workflow approves at Level 2 (WAHIS) or Level 4 (analytics),
 * this consumer updates the local health event entity.
 */
@Injectable()
export class WorkflowFlagConsumer implements OnModuleInit {
  private readonly logger = new Logger(WorkflowFlagConsumer.name);

  constructor(
    private readonly eventConsumer: EventConsumer,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.eventConsumer.subscribeAll([
        {
          topic: EVENTS.WORKFLOW.WAHIS_READY,
          groupId: 'animal-health-wahis-ready-consumer',
          handler: async (event) => {
            await this.handleWahisReady(event as WorkflowWahisReadyEvent);
          },
        },
        {
          topic: EVENTS.WORKFLOW.ANALYTICS_READY,
          groupId: 'animal-health-analytics-ready-consumer',
          handler: async (event) => {
            await this.handleAnalyticsReady(
              event as WorkflowAnalyticsReadyEvent,
            );
          },
        },
      ]);

      this.logger.log(
        'Subscribed to workflow WAHIS ready and analytics ready events',
      );
    } catch (error) {
      this.logger.warn(
        `Kafka consumers not available — workflow flag updates disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleWahisReady(
    event: WorkflowWahisReadyEvent,
  ): Promise<void> {
    const { entityType, entityId, domain } = event.payload;

    // Only handle animal-health domain entities
    if (domain !== 'health' && domain !== 'animal-health') return;

    this.logger.log(
      `Setting wahisReady=true for ${entityType}/${entityId}`,
    );

    try {
      await this.updateEntityFlag(entityId, { wahisReady: true });
    } catch (error) {
      this.logger.error(
        `Failed to set wahisReady for ${entityType}/${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async handleAnalyticsReady(
    event: WorkflowAnalyticsReadyEvent,
  ): Promise<void> {
    const { entityType, entityId, domain } = event.payload;

    // Only handle animal-health domain entities
    if (domain !== 'health' && domain !== 'animal-health') return;

    this.logger.log(
      `Setting analyticsReady=true for ${entityType}/${entityId}`,
    );

    try {
      await this.updateEntityFlag(entityId, { analyticsReady: true });
    } catch (error) {
      this.logger.error(
        `Failed to set analyticsReady for ${entityType}/${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async updateEntityFlag(
    entityId: string,
    flags: { wahisReady?: boolean; analyticsReady?: boolean },
  ): Promise<void> {
    // Update the health event entity with the flag
    await this.prisma.healthEvent.update({
      where: { id: entityId },
      data: flags,
    });
  }
}
