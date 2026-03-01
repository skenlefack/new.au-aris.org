import { Inject } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';

/**
 * Shorthand decorator to inject CacheService.
 * Use this instead of `@Inject(CacheService)` for readability.
 */
export const InjectCache = (): ParameterDecorator => Inject(CacheService);

/**
 * Shorthand decorator to inject CacheInvalidationService.
 */
export const InjectCacheInvalidation = (): ParameterDecorator => Inject(CacheInvalidationService);
