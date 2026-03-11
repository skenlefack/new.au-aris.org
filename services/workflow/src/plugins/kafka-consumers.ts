import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { StandaloneKafkaConsumer } from '@aris/kafka-client';
import { TOPIC_AU_QUALITY_RECORD_VALIDATED } from '@aris/shared-types';

interface QualityValidatedPayload {
  reportId: string;
  recordId: string;
  entityType: string;
  domain: string;
  overallStatus: string;
}

export default fp(
  async (app: FastifyInstance) => {
    const kafkaConsumer = new StandaloneKafkaConsumer({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-workflow-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    });

    // Subscribe to quality validated events (auto-advance Level 1)
    app.ready().then(async () => {
      try {
        await kafkaConsumer.subscribe(
          {
            topic: TOPIC_AU_QUALITY_RECORD_VALIDATED,
            groupId: 'workflow-quality-consumer',
          },
          async (payload) => {
            const data = payload as QualityValidatedPayload | null;
            if (!data) return;

            if (data.overallStatus !== 'PASSED' && data.overallStatus !== 'WARNING') {
              return;
            }

            try {
              await app.workflowService.autoAdvanceLevel1(
                data.recordId,
                data.reportId,
              );
            } catch (error) {
              app.log.error(
                `Failed to auto-advance Level 1 for entity ${data.recordId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          },
        );
        app.log.info(`Subscribed to ${TOPIC_AU_QUALITY_RECORD_VALIDATED} (group: workflow-quality-consumer)`);
      } catch (error) {
        app.log.warn(
          `Kafka consumer not available — quality auto-advance disabled: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Subscribe to workflow instance requests (from collecte service)
      try {
        await kafkaConsumer.subscribe(
          {
            topic: 'au.workflow.instance.requested.v1',
            groupId: 'workflow-instance-request-consumer',
          },
          async (payload) => {
            const event = payload as {
              payload: {
                entityType: string;
                entityId: string;
                domain: string;
                qualityReportId?: string;
                dataContractId?: string;
              };
              tenantId?: string;
              userId?: string;
              correlationId?: string;
            } | null;
            if (!event?.payload) return;

            const { entityType, entityId, domain, qualityReportId, dataContractId } = event.payload;

            const user = {
              userId: event.userId ?? '00000000-0000-0000-0000-000000000000',
              tenantId: event.tenantId ?? '',
              role: 'SYSTEM' as const,
              tenantLevel: 'CONTINENTAL' as const,
              email: 'system@au-aris.org',
            };

            try {
              await app.workflowService.create(
                { entityType, entityId, domain, qualityReportId, dataContractId },
                user as never,
              );
            } catch (error) {
              app.log.error(
                `Failed to create workflow instance for ${entityType}/${entityId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          },
        );
        app.log.info('Subscribed to au.workflow.instance.requested.v1 (group: workflow-instance-request-consumer)');
      } catch (error) {
        app.log.warn(
          `Kafka consumer not available — async workflow creation disabled: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    app.addHook('onClose', async () => {
      // StandaloneKafkaConsumer manages its own consumers
    });
  },
  { name: 'kafka-consumers' },
);
