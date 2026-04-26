/**
 * rate-limiter.ts — Redis-based rate limiter for AI endpoints.
 * Max 20 AI requests per minute per user.
 */

import type Redis from 'ioredis';

const DEFAULT_MAX_REQUESTS = 20;
const WINDOW_SECONDS = 60;
const KEY_PREFIX = 'aris:ai:ratelimit:';

export class RateLimiter {
  constructor(
    private redis: Redis,
    private maxRequests: number = DEFAULT_MAX_REQUESTS,
  ) {}

  /**
   * Check and increment the rate limit for a user.
   * Returns { allowed, remaining, retryAfterMs }.
   */
  async check(userId: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
    const key = `${KEY_PREFIX}${userId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    // Use sorted set: score = timestamp, member = unique request id
    const pipeline = this.redis.pipeline();
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Count current entries
    pipeline.zcard(key);
    // Add new entry
    pipeline.zadd(key, now.toString(), `${now}:${Math.random().toString(36).slice(2, 8)}`);
    // Set expiry on the key
    pipeline.expire(key, WINDOW_SECONDS + 1);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= this.maxRequests) {
      // Get the oldest entry to calculate retry-after
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTs = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
      const retryAfterMs = Math.max(0, oldestTs + WINDOW_SECONDS * 1000 - now);

      // Remove the entry we just added since we're rejecting
      pipeline.zremrangebyscore(key, now, now + 1);

      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - currentCount - 1,
      retryAfterMs: 0,
    };
  }
}
