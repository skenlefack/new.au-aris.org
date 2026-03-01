import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from './cache.service';
import type { CacheInvalidationRule } from './cache.types';

/**
 * Service that handles cache invalidation based on domain events.
 *
 * Services can register invalidation rules, then call `handleEvent()` when
 * they receive Kafka messages (via @aris/kafka-client) to automatically
 * invalidate the relevant cache entries.
 *
 * @example
 * ```typescript
 * // In your service module
 * constructor(
 *   @Inject(CacheInvalidationService) private readonly invalidation: CacheInvalidationService,
 * ) {
 *   this.invalidation.registerRules([
 *     {
 *       topic: 'ms.health.outbreak.created.v1',
 *       domain: 'health',
 *       entity: 'outbreak',
 *       extractId: (payload) => payload.id as string,
 *     },
 *     {
 *       topic: 'sys.master.species.updated.v1',
 *       domain: 'master',
 *       entity: 'species',
 *       // No extractId → invalidates ALL species cache entries
 *     },
 *   ]);
 * }
 *
 * // In your Kafka consumer handler
 * async handleOutbreakCreated(message: KafkaMessage) {
 *   await this.invalidation.handleEvent('ms.health.outbreak.created.v1', message.value);
 * }
 * ```
 */
@Injectable()
export class CacheInvalidationService implements OnModuleInit {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly rules = new Map<string, CacheInvalidationRule[]>();

  constructor(
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  onModuleInit(): void {
    this.logger.log(`Cache invalidation initialized with ${this.rules.size} topic(s)`);
  }

  /**
   * Register one or more invalidation rules.
   * Multiple rules can map to the same topic (e.g. an outbreak update invalidates
   * both the outbreak cache and the dashboard cache).
   */
  registerRules(rules: CacheInvalidationRule[]): void {
    for (const rule of rules) {
      const existing = this.rules.get(rule.topic) ?? [];
      existing.push(rule);
      this.rules.set(rule.topic, existing);
      this.logger.debug(`Registered invalidation: ${rule.topic} → ${rule.domain}:${rule.entity}`);
    }
  }

  /**
   * Handle a domain event and invalidate matching cache entries.
   *
   * @param topic - The Kafka topic the event came from
   * @param payload - The deserialized event payload
   * @returns Number of cache keys invalidated
   */
  async handleEvent(topic: string, payload: Record<string, unknown>): Promise<number> {
    const topicRules = this.rules.get(topic);
    if (!topicRules || topicRules.length === 0) {
      return 0;
    }

    let totalInvalidated = 0;

    for (const rule of topicRules) {
      try {
        if (rule.extractId) {
          const id = rule.extractId(payload);
          if (id) {
            const deleted = await this.cache.invalidateEntity(rule.domain, rule.entity, id);
            if (deleted) totalInvalidated++;
            // Also invalidate list caches for this entity type
            totalInvalidated += await this.cache.invalidateByPattern(rule.domain, `${rule.entity}:list`);
          }
        } else {
          // No ID extractor → invalidate all entries for this domain+entity
          totalInvalidated += await this.cache.invalidateByPattern(rule.domain, rule.entity);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to invalidate cache for ${rule.domain}:${rule.entity}: ${message}`);
      }
    }

    if (totalInvalidated > 0) {
      this.logger.debug(`Invalidated ${totalInvalidated} keys for topic: ${topic}`);
    }

    return totalInvalidated;
  }

  /** Get all registered topics. */
  getRegisteredTopics(): string[] {
    return Array.from(this.rules.keys());
  }
}
