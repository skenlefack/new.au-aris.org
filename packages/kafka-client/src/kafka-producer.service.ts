import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Kafka, Producer, RecordMetadata } from 'kafkajs';
import type { KafkaHeaders, KafkaEvent } from '@aris/shared-types';
import { KAFKA_INSTANCE_TOKEN } from './kafka.config';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer;

  constructor(
    @Inject(KAFKA_INSTANCE_TOKEN) private readonly kafka: Kafka,
  ) {
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      transactionalId: undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
    this.logger.log('Kafka producer disconnected');
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

    return this.sendWithRetry(
      event.topic,
      event.key,
      event.payload,
      headers,
    );
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
      this.logger.debug(`Published to ${topic} [key=${key}]`);
      return result;
    } catch (error) {
      if (attempt >= maxRetries) {
        this.logger.error(
          `Failed to publish to ${topic} after ${maxRetries} attempts`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      this.logger.warn(
        `Publish to ${topic} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`,
      );
      await this.sleep(delay);
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
