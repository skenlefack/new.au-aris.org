import {
  Injectable,
  Inject,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import {
  Kafka,
  Consumer,
  EachMessagePayload,
  KafkaMessage,
} from 'kafkajs';
import { KAFKA_INSTANCE_TOKEN, KAFKA_CONFIG_TOKEN, KafkaConfig } from './kafka.config';
import { TOPIC_DLQ_ALL } from '@aris/shared-types';

export interface ConsumeOptions {
  topic: string;
  groupId: string;
  fromBeginning?: boolean;
  maxRetries?: number;
  dlqTopic?: string;
}

export type MessageHandler = (
  payload: unknown,
  headers: Record<string, string | undefined>,
  raw: KafkaMessage,
) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumers: Consumer[] = [];

  constructor(
    @Inject(KAFKA_INSTANCE_TOKEN) private readonly kafka: Kafka,
    @Inject(KAFKA_CONFIG_TOKEN) private readonly config: KafkaConfig,
  ) {}

  async onModuleDestroy(): Promise<void> {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    this.logger.log(`Disconnected ${this.consumers.length} Kafka consumers`);
  }

  async subscribe(
    options: ConsumeOptions,
    handler: MessageHandler,
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
          this.logger.error(
            `Error processing message from ${topic}[${partition}] offset=${message.offset}`,
            error instanceof Error ? error.stack : String(error),
          );

          if (retryCount >= maxRetries) {
            this.logger.warn(
              `Max retries (${maxRetries}) exceeded for ${topic}[${partition}] offset=${message.offset}, sending to DLQ`,
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
    this.logger.log(`Subscribed to ${topic} with group ${groupId}`);
    return consumer;
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
      this.logger.error(
        `Failed to send message to DLQ ${dlqTopic}`,
        dlqError instanceof Error ? dlqError.stack : String(dlqError),
      );
    }
  }
}
