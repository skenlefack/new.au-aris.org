import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventConsumer, EventPublisher, EVENTS } from '@aris/kafka-client';
import type {
  WorkflowInstanceRequestedEvent,
  WorkflowInstanceCreatedEvent,
} from '@aris/kafka-client';
import { WorkflowService } from './workflow.service';

/**
 * Kafka consumer that handles asynchronous workflow instance creation requests.
 *
 * Replaces the synchronous REST POST /api/v1/workflow/instances endpoint
 * for inter-service calls. The REST endpoint remains for external clients.
 *
 * Flow:
 * 1. collecte-service publishes WORKFLOW.INSTANCE_REQUESTED
 * 2. This consumer creates the workflow instance
 * 3. Publishes WORKFLOW.INSTANCE_CREATED back
 * 4. collecte-service consumes that to link workflowInstanceId to submission
 */
@Injectable()
export class WorkflowRequestConsumer implements OnModuleInit {
  private readonly logger = new Logger(WorkflowRequestConsumer.name);

  constructor(
    private readonly eventConsumer: EventConsumer,
    private readonly eventPublisher: EventPublisher,
    private readonly workflowService: WorkflowService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.eventConsumer.subscribe({
        topic: EVENTS.WORKFLOW.INSTANCE_REQUESTED,
        groupId: 'workflow-instance-request-consumer',
        handler: async (event) => {
          await this.handleInstanceRequest(event as unknown as WorkflowInstanceRequestedEvent);
        },
      });
      this.logger.log(`Subscribed to ${EVENTS.WORKFLOW.INSTANCE_REQUESTED}`);
    } catch (error) {
      this.logger.warn(
        `Kafka consumer not available — async workflow creation disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleInstanceRequest(
    event: WorkflowInstanceRequestedEvent,
  ): Promise<void> {
    const { entityType, entityId, domain, qualityReportId, dataContractId } =
      event.payload;

    this.logger.log(
      `Processing workflow instance request for ${entityType}/${entityId}`,
    );

    // Build a synthetic AuthenticatedUser from event metadata
    const user = {
      userId: event.userId ?? '00000000-0000-0000-0000-000000000000',
      tenantId: event.tenantId ?? '',
      role: 'SYSTEM' as const,
      tenantLevel: 'CONTINENTAL' as const,
      email: 'system@au-aris.org',
    };

    try {
      const result = await this.workflowService.create(
        {
          entityType,
          entityId,
          domain,
          qualityReportId,
          dataContractId,
        },
        user as never,
      );

      const instance = result.data;

      // Publish WORKFLOW.INSTANCE_CREATED so collecte-service can link it
      await this.eventPublisher.publish<WorkflowInstanceCreatedEvent>(
        EVENTS.WORKFLOW.INSTANCE_CREATED,
        {
          eventType: EVENTS.WORKFLOW.INSTANCE_CREATED,
          source: 'workflow-service',
          version: 1,
          tenantId: event.tenantId,
          userId: event.userId,
          correlationId: event.correlationId,
          payload: {
            instanceId: instance.id,
            entityType: instance.entityType,
            entityId: instance.entityId,
            domain: instance.domain,
            currentLevel: instance.currentLevel,
            status: instance.status,
          },
        },
        { key: entityId },
      );

      this.logger.log(
        `Workflow instance ${instance.id} created for ${entityType}/${entityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create workflow instance for ${entityType}/${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
