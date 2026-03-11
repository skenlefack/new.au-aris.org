// Module
export { CacheModule } from './cache.module';

// Services
export { CacheService } from './cache.service';
export { CacheInvalidationService } from './cache-invalidation.service';

// Config
export type { CacheConfig } from './cache.config';
export {
  CACHE_CONFIG_TOKEN,
  CACHE_REDIS_TOKEN,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_TTLS,
  buildCacheKey,
  buildListCacheKey,
  buildInvalidationPattern,
} from './cache.config';

// Types
export type { CacheStats, CacheInvalidationRule } from './cache.types';

// Decorators
export { InjectCache, InjectCacheInvalidation } from './cache.decorators';

// Testing
export { MockCacheService } from './testing/mock-cache.service';

// Standalone (no NestJS)
export { getRedisClient, StandaloneCacheService } from './standalone';

// OpenSearch client
export { createOpenSearchClient } from './opensearch.client';
export type { OpenSearchConfig } from './opensearch.client';
