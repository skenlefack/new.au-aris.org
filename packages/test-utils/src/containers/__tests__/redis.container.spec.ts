import { describe, it, expect, afterAll } from 'vitest';
import { startRedisContainer, type RedisContainerResult } from '../redis.container';

describe('startRedisContainer', () => {
  let redis: RedisContainerResult | undefined;

  afterAll(async () => {
    if (redis) {
      await redis.container.stop();
    }
  });

  it('should start a Redis container and return connection details', async () => {
    redis = await startRedisContainer();

    expect(redis.container).toBeDefined();
    expect(redis.redisUrl).toContain('redis://');
    expect(redis.host).toBeDefined();
    expect(typeof redis.port).toBe('number');
    expect(redis.port).toBeGreaterThan(0);
  });

  it('should return a valid Redis URL format', async () => {
    if (!redis) {
      redis = await startRedisContainer();
    }

    const url = new URL(redis.redisUrl);
    expect(url.protocol).toBe('redis:');
    expect(url.hostname).toBe(redis.host);
    expect(url.port).toBe(String(redis.port));
  });
});
