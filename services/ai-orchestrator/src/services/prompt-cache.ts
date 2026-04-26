/**
 * prompt-cache.ts — Cache AI generation results in Redis.
 * Key = hash of prompt + model, TTL = 1 hour.
 */

import type Redis from 'ioredis';
import { createHash } from 'crypto';

const KEY_PREFIX = 'aris:ai:cache:';
const DEFAULT_TTL_SECONDS = 3600; // 1 hour

export class PromptCache {
  constructor(
    private redis: Redis,
    private ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ) {}

  /**
   * Build a cache key from model + prompt + optional params hash.
   */
  buildKey(model: string, prompt: string, extra?: string): string {
    const hash = createHash('sha256')
      .update(`${model}::${prompt}::${extra ?? ''}`)
      .digest('hex')
      .slice(0, 32);
    return `${KEY_PREFIX}${hash}`;
  }

  /**
   * Get cached result if available.
   */
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Store result in cache.
   */
  async set(key: string, value: unknown): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
  }
}
