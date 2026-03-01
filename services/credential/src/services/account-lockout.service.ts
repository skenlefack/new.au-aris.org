import type Redis from 'ioredis';

const MAX_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 30 * 60; // 30 minutes
const KEY_PREFIX = 'lockout:';

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
}
