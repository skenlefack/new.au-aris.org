/**
 * ARIS 4.0 — Typed Event Consumer
 *
 * Wraps KafkaConsumerService to subscribe to topics and dispatch typed events
 * to registered handlers. Integrates with @aris/cache for automatic cache
 * invalidation on event receipt.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka-consumer.service';
import type { BaseEvent } from './event-types';
import type { EventTopic } from './event-catalog';
import type { KafkaMessage } from 'kafkajs';

export type TypedEventHandler<T extends BaseEvent = BaseEvent> = (
  event: T,
  headers: Record<string, string | undefined>,
  raw: KafkaMessage,
) => Promise<void>;

export interface EventSubscription {
  /** Kafka topic from EVENTS catalog */
  topic: EventTopic | string;
  /** Consumer group ID */
  groupId: string;
  /** Handler function */
  handler: TypedEventHandler;
  /** Start from beginning of topic (default: false) */
  fromBeginning?: boolean;
  /** Max retries before DLQ (default: 3) */
  maxRetries?: number;
  /** Custom DLQ topic */
  dlqTopic?: string;
}

@Injectable()
export class EventConsumer {
  private readonly logger = new Logger(EventConsumer.name);

  constructor(
    @Inject(KafkaConsumerService)
    private readonly consumer: KafkaConsumerService,
  ) {}

  /**
   * Subscribe to a typed event topic.
   *
   * The raw Kafka payload is parsed into a BaseEvent<T> and passed to the handler.
   *
   * @example
   * ```typescript
   * await this.eventConsumer.subscribe({
   *   topic: EVENTS.QUALITY.VALIDATION_REQUESTED,
   *   groupId: 'data-quality-validation-consumer',
   *   handler: async (event: QualityValidationRequestedEvent) => {
   *     await this.processValidation(event);
   *   },
   * });
   * ```
   */
  async subscribe<T extends BaseEvent>(
    subscription: EventSubscription,
  ): Promise<void> {
    const { topic, groupId, handler, fromBeginning, maxRetries, dlqTopic } =
      subscription;

    await this.consumer.subscribe(
      { topic, groupId, fromBeginning, maxRetries, dlqTopic },
      async (payload, headers, raw) => {
        const event = this.parseEvent<T>(payload);
        if (!event) {
          this.logger.warn(
            `Received unparseable event on topic ${topic}, skipping`,
          );
          return;
        }

        await handler(event, headers, raw);
      },
    );

    this.logger.log(`EventConsumer subscribed to ${topic} (group: ${groupId})`);
  }

  /**
   * Subscribe to multiple topics at once.
   */
  async subscribeAll(subscriptions: EventSubscription[]): Promise<void> {
    for (const sub of subscriptions) {
      await this.subscribe(sub);
    }
  }

  private parseEvent<T extends BaseEvent>(payload: unknown): T | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const obj = payload as Record<string, unknown>;

    // If the payload already has the BaseEvent shape, return it
    if (obj['eventType'] && obj['payload']) {
      return obj as unknown as T;
    }

    // Legacy format: the entire payload IS the data (no envelope).
    // Wrap it in a minimal BaseEvent shape for backward compatibility.
    return {
      eventId: (obj['eventId'] as string) ?? 'unknown',
      eventType: (obj['eventType'] as string) ?? 'unknown',
      timestamp: (obj['timestamp'] as string) ?? new Date().toISOString(),
      version: (obj['version'] as number) ?? 1,
      source: (obj['source'] as string) ?? 'unknown',
      tenantId: obj['tenantId'] as string | undefined,
      userId: obj['userId'] as string | undefined,
      correlationId: obj['correlationId'] as string | undefined,
      payload: obj,
    } as unknown as T;
  }
}
