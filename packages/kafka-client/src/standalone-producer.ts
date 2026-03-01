import { Kafka, Producer, RecordMetadata, logLevel } from 'kafkajs';
import type { KafkaHeaders, KafkaEvent } from '@aris/shared-types';
import type { KafkaConfig } from './kafka.config';
import { DEFAULT_KAFKA_CONFIG } from './kafka.config';

/**
 * Standalone Kafka producer — no NestJS decorators.
 * Use this for pure-Fastify services.
 */
export class StandaloneKafkaProducer {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private connected = false;

  constructor(config: KafkaConfig) {
    const merged = { ...DEFAULT_KAFKA_CONFIG, ...config };

    const isIdempotent = merged.producer?.idempotent ?? true;

    this.kafka = new Kafka({
      clientId: merged.clientId,
      brokers: merged.brokers,
      ssl: merged.ssl,
      sasl: merged.sasl as any,
      retry: {
        // Idempotent producers require unlimited retries to guarantee EoS
        retries: isIdempotent
          ? Number.MAX_SAFE_INTEGER
          : (merged.retry?.maxRetries ?? 5),
        initialRetryTime: merged.retry?.initialRetryTime ?? 300,
        maxRetryTime: merged.retry?.maxRetryTime ?? 30000,
        factor: merged.retry?.factor ?? 2,
      },
      logLevel: logLevel.WARN,
    });

    this.producer = this.kafka.producer({
      idempotent: isIdempotent,
      maxInFlightRequests: merged.producer?.maxInFlightRequests ?? 1,
      transactionalId: undefined,
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }

  async publish<T>(event: KafkaEvent<T>): Promise<RecordMetadata[]> {
    const headers: Record<string, string> = {
      correlationId: event.headers.correlationId,
      sourceService: event.headers.sourceService,
      tenantId: event.headers.tenantId,
      schemaVersion: event.headers.schemaVersion,
      timestamp: event.headers.timestamp,
    };

    if (event.headers.userId) {
      headers['userId'] = event.headers.userId;
    }

    return this.sendWithRetry(event.topic, event.key, event.payload, headers);
  }

  async send<T>(
    topic: string,
    key: string,
    payload: T,
    headers: KafkaHeaders,
  ): Promise<RecordMetadata[]> {
    const headerRecord: Record<string, string> = {
      correlationId: headers.correlationId,
      sourceService: headers.sourceService,
      tenantId: headers.tenantId,
      schemaVersion: headers.schemaVersion,
      timestamp: headers.timestamp,
    };

    if (headers.userId) {
      headerRecord['userId'] = headers.userId;
    }

    return this.sendWithRetry(topic, key, payload, headerRecord);
  }

  private async sendWithRetry<T>(
    topic: string,
    key: string,
    payload: T,
    headers: Record<string, string>,
    attempt = 1,
    maxRetries = 3,
    baseDelay = 300,
  ): Promise<RecordMetadata[]> {
    try {
      const result = await this.producer.send({
        topic,
        messages: [
          {
            key,
            value: JSON.stringify(payload),
            headers,
          },
        ],
      });
      return result;
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.sendWithRetry(
        topic,
        key,
        payload,
        headers,
        attempt + 1,
        maxRetries,
        baseDelay,
      );
    }
  }
}
