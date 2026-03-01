export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of Redis errors */
  errors: number;
  /** Hit rate (0 to 1) */
  hitRate: number;
  /** Total get requests (hits + misses) */
  totalRequests: number;
}

/**
 * Options for Kafka-driven cache invalidation.
 */
export interface CacheInvalidationRule {
  /** Kafka topic to subscribe to (e.g. 'ms.health.outbreak.updated.v1') */
  topic: string;
  /** Domain identifier (e.g. 'health') */
  domain: string;
  /** Entity name (e.g. 'outbreak') */
  entity: string;
  /**
   * Optional extractor to get entity ID from Kafka message payload.
   * If provided, only that entity is invalidated; otherwise the entire entity pattern is invalidated.
   */
  extractId?: (payload: Record<string, unknown>) => string | null;
}
