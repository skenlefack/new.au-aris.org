import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

const MAX_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 30 * 60; // 30 minutes
const KEY_PREFIX = 'lockout:';

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(private readonly redis: RedisService) {}

  async recordFailedAttempt(email: string): Promise<number> {
    const key = `${KEY_PREFIX}${email}`;
    const count = await this.redis.incr(key);

    // Set/refresh TTL on first attempt or any subsequent attempt
    await this.redis.expire(key, LOCKOUT_TTL_SECONDS);

    if (count >= MAX_ATTEMPTS) {
      this.logger.warn(`Account locked for ${email} after ${count} failed attempts`);
    }

    return count;
  }

  async isLocked(email: string): Promise<boolean> {
    const key = `${KEY_PREFIX}${email}`;
    const value = await this.redis.get(key);

    if (value === null) {
      return false;
    }

    return parseInt(value, 10) >= MAX_ATTEMPTS;
  }

  async resetAttempts(email: string): Promise<void> {
    const key = `${KEY_PREFIX}${email}`;
    await this.redis.del(key);
  }
}
