import { Kafka, Consumer, KafkaMessage, EachMessagePayload } from 'kafkajs';
import type { KafkaConfig } from './kafka.config';
import { DEFAULT_KAFKA_CONFIG } from './kafka.config';
import { TOPIC_DLQ_ALL } from '@aris/shared-types';

export interface StandaloneConsumeOptions {
  topic: string;
  groupId: string;
  fromBeginning?: boolean;
  maxRetries?: number;
  dlqTopic?: string;
}

export type StandaloneMessageHandler = (
  payload: unknown,
  headers: Record<string, string | undefined>,
  raw: KafkaMessage,
) => Promise<void>;

/**
 * Standalone Kafka consumer — no NestJS decorators.
 * Use this for pure-Fastify services.
 */
export class StandaloneKafkaConsumer {
  private readonly kafka: Kafka;
  private readonly consumers: Consumer[] = [];
  private readonly config: KafkaConfig;

  constructor(config: KafkaConfig) {
    this.config = { ...DEFAULT_KAFKA_CONFIG, ...config } as KafkaConfig;

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      ssl: this.config.ssl,
      sasl: this.config.sasl as any,
      retry: {
        retries: this.config.retry?.maxRetries ?? 5,
        initialRetryTime: this.config.retry?.initialRetryTime ?? 300,
        maxRetryTime: this.config.retry?.maxRetryTime ?? 30000,
        factor: this.config.retry?.factor ?? 2,
      },
    });
  }

  async subscribe(
    options: StandaloneConsumeOptions,
    handler: StandaloneMessageHandler,
  ): Promise<Consumer> {
    const {
      topic,
      groupId,
      fromBeginning = false,
      maxRetries = 3,
      dlqTopic = TOPIC_DLQ_ALL,
    } = options;

    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: this.config.consumer?.sessionTimeout ?? 30000,
      heartbeatInterval: this.config.consumer?.heartbeatInterval ?? 3000,
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning });

    await consumer.run({
      autoCommit: false,
      eachMessage: async (messagePayload: EachMessagePayload) => {
        const { message, partition, heartbeat } = messagePayload;
        const retryCount = this.getRetryCount(message);

        try {
          const payload = message.value
            ? JSON.parse(message.value.toString())
            : null;
          const headers = this.parseHeaders(message);

          await handler(payload, headers, message);
          await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (BigInt(message.offset) + 1n).toString(),
            },
          ]);
        } catch (error) {
          console.error(
            `[StandaloneKafkaConsumer] Error processing ${topic}[${partition}] offset=${message.offset}`,
            error instanceof Error ? error.stack : String(error),
          );

          if (retryCount >= maxRetries) {
            console.warn(
              `[StandaloneKafkaConsumer] Max retries (${maxRetries}) exceeded for ${topic}[${partition}], sending to DLQ`,
            );
            await this.sendToDlq(dlqTopic, topic, message, error);
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (BigInt(message.offset) + 1n).toString(),
              },
            ]);
          } else {
            message.headers = {
              ...message.headers,
              'x-retry-count': Buffer.from(String(retryCount + 1)),
              'x-original-topic': Buffer.from(topic),
            };
            throw error;
          }
        }

        await heartbeat();
      },
    });

    this.consumers.push(consumer);
    console.log(`[StandaloneKafkaConsumer] Subscribed to ${topic} with group ${groupId}`);
    return consumer;
  }

  async disconnect(): Promise<void> {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    console.log(`[StandaloneKafkaConsumer] Disconnected ${this.consumers.length} consumers`);
  }

  /** Alias for disconnect() */
  async disconnectAll(): Promise<void> {
    return this.disconnect();
  }

  private getRetryCount(message: KafkaMessage): number {
    const header = message.headers?.['x-retry-count'];
    if (!header) return 0;
    const value = Buffer.isBuffer(header) ? header.toString() : String(header);
    return parseInt(value, 10) || 0;
  }

  private parseHeaders(
    message: KafkaMessage,
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        result[key] = value
          ? Buffer.isBuffer(value)
            ? value.toString()
            : String(value)
          : undefined;
      }
    }
    return result;
  }

  private async sendToDlq(
    dlqTopic: string,
    originalTopic: string,
    message: KafkaMessage,
    error: unknown,
  ): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();
      await producer.send({
        topic: dlqTopic,
        messages: [
          {
            key: message.key,
            value: message.value,
            headers: {
              ...message.headers,
              'x-original-topic': Buffer.from(originalTopic),
              'x-error-message': Buffer.from(
                error instanceof Error ? error.message : String(error),
              ),
              'x-failed-at': Buffer.from(new Date().toISOString()),
            },
          },
        ],
      });
      await producer.disconnect();
    } catch (dlqError) {
      console.error(
        `[StandaloneKafkaConsumer] Failed to send to DLQ ${dlqTopic}`,
        dlqError instanceof Error ? dlqError.stack : String(dlqError),
      );
    }
  }
}
