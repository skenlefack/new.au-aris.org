import type { FastifyInstance } from 'fastify';
import type { IngestionService } from '../services/ingestion.service';

/**
 * Creates a domain event handler for the datalake OLAP ingester.
 * Receives raw Kafka messages and delegates to the ingestion service.
 */
export function createDomainEventHandler(
  app: FastifyInstance,
  ingestionService: IngestionService,
) {
  return async (
    payload: unknown,
    headers: Record<string, string | undefined>,
    raw: import('kafkajs').KafkaMessage,
  ): Promise<void> => {
    try {
      // Extract original topic from headers or raw message
      const topic = headers['x-original-topic']
        ?? headers['topic']
        ?? 'unknown.unknown.unknown.unknown.v1';

      await ingestionService.ingest(topic, payload, headers);
    } catch (err) {
      app.log.error(
        `[DomainEventConsumer] Failed to ingest event: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Log and continue — don't crash the consumer
    }
  };
}
