/**
 * ARIS 4.0 — Standardized Event Publisher
 *
 * Wraps KafkaProducerService to publish typed BaseEvent envelopes.
 * Automatically fills eventId, timestamp, and correlationId if not provided.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { KafkaProducerService } from '../kafka-producer.service';
import type { BaseEvent } from './event-types';
import type { EventTopic } from './event-catalog';

export interface PublishOptions {
  /** Kafka partition key (defaults to eventId) */
  key?: string;
}

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(
    @Inject(KafkaProducerService)
    private readonly producer: KafkaProducerService,
  ) {}

  /**
   * Publish a typed event to Kafka.
   *
   * The `topic` is the Kafka topic string (from EVENTS catalog).
   * The `event` must include `eventType`, `source`, `version`, and `payload`.
   * Fields `eventId`, `timestamp`, and `correlationId` are auto-filled if omitted.
   *
   * @example
   * ```typescript
   * await this.publisher.publish(EVENTS.QUALITY.VALIDATION_REQUESTED, {
   *   eventType: EVENTS.QUALITY.VALIDATION_REQUESTED,
   *   source: 'collecte-service',
   *   version: 1,
   *   tenantId: user.tenantId,
   *   userId: user.userId,
   *   payload: { recordId, entityType, domain, record },
   * });
   * ```
   */
  async publish<T extends BaseEvent>(
    topic: EventTopic | string,
    event: Omit<T, 'eventId' | 'timestamp'> &
      Partial<Pick<T, 'eventId' | 'timestamp'>>,
    options?: PublishOptions,
  ): Promise<void> {
    const eventId = event.eventId ?? uuid();
    const timestamp = event.timestamp ?? new Date().toISOString();
    const correlationId = event.correlationId ?? uuid();

    const fullEvent = {
      ...event,
      eventId,
      timestamp,
      correlationId,
    } as T;

    const key = options?.key ?? eventId;

    const headers = {
      correlationId,
      sourceService: fullEvent.source,
      tenantId: fullEvent.tenantId ?? '',
      schemaVersion: String(fullEvent.version),
      timestamp,
      ...(fullEvent.userId ? { userId: fullEvent.userId } : {}),
    };

    await this.producer.send(topic, key, fullEvent, headers);

    this.logger.debug(
      `Published ${fullEvent.eventType} [key=${key}] to ${topic}`,
    );
  }
}
