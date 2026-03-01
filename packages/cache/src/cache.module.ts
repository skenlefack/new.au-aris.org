import { DynamicModule, Module, Global } from '@nestjs/common';
import { CacheConfig, CACHE_CONFIG_TOKEN, DEFAULT_CACHE_CONFIG } from './cache.config';
import { CacheService } from './cache.service';

@Global()
@Module({})
export class CacheModule {
  /**
   * Register the cache module with static configuration.
   *
   * @example
   * ```typescript
   * CacheModule.forRoot({
   *   url: process.env.REDIS_URL ?? 'redis://localhost:6379',
   *   keyPrefix: 'aris:credential:',
   *   defaultTtlSeconds: 300,
   * })
   * ```
   */
  static forRoot(config: CacheConfig): DynamicModule {
    const mergedConfig: CacheConfig = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
    };

    return {
      module: CacheModule,
      providers: [
        {
          provide: CACHE_CONFIG_TOKEN,
          useValue: mergedConfig,
        },
        CacheService,
      ],
      exports: [CacheService, CACHE_CONFIG_TOKEN],
    };
  }

  /**
   * Register the cache module with async configuration (e.g. from ConfigService).
   *
   * @example
   * ```typescript
   * CacheModule.forRootAsync({
   *   useFactory: (configService: ConfigService) => ({
   *     url: configService.get('REDIS_URL'),
   *     keyPrefix: 'aris:credential:',
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => CacheConfig | Promise<CacheConfig>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: CACHE_CONFIG_TOKEN,
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            return { ...DEFAULT_CACHE_CONFIG, ...config };
          },
          inject: options.inject ?? [],
        },
        CacheService,
      ],
      exports: [CacheService, CACHE_CONFIG_TOKEN],
    };
  }
}
