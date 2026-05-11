import type Redis from 'ioredis';

const MAX_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 30 * 60; // 30 minutes
const KEY_PREFIX = 'lockout:';

export interface LockedAccount {
  email: string;
  attempts: number;
  ttl: number; // seconds remaining
}

export class AccountLockoutService {
  constructor(private readonly redis: Redis) {}

  async recordFailedAttempt(email: string): Promise<number> {
    const key = `${KEY_PREFIX}${email}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, LOCKOUT_TTL_SECONDS);
    return count;
  }

  async isLocked(email: string): Promise<boolean> {
    const key = `${KEY_PREFIX}${email}`;
    const value = await this.redis.get(key);
    if (value === null) return false;
    return parseInt(value, 10) >= MAX_ATTEMPTS;
  }

  async resetAttempts(email: string): Promise<void> {
    const key = `${KEY_PREFIX}${email}`;
    await this.redis.del(key);
  }

  /** List all currently locked accounts (attempts >= MAX_ATTEMPTS). */
  async listLocked(): Promise<LockedAccount[]> {
    const keys = await this.redis.keys(`${KEY_PREFIX}*`);
    if (keys.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.get(key);
      pipeline.ttl(key);
    }
    const results = await pipeline.exec();
    if (!results) return [];

    const locked: LockedAccount[] = [];
    for (let i = 0; i < keys.length; i++) {
      const value = results[i * 2]?.[1] as string | null;
      const ttl = results[i * 2 + 1]?.[1] as number;
      const attempts = value ? parseInt(value, 10) : 0;
      if (attempts >= MAX_ATTEMPTS) {
        locked.push({
          email: keys[i].replace(KEY_PREFIX, ''),
          attempts,
          ttl: ttl > 0 ? ttl : 0,
        });
      }
    }
    return locked;
  }
}
