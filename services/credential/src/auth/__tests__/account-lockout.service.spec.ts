import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountLockoutService } from '../account-lockout.service';

function mockRedisService() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  return {
    incr: vi.fn(async (key: string) => {
      const current = parseInt(store.get(key) ?? '0', 10);
      const next = current + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async (_key: string, _seconds: number) => {
      ttls.set(_key, _seconds);
      return 1;
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    // helpers for test assertions
    _store: store,
    _ttls: ttls,
  };
}

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;
  let redis: ReturnType<typeof mockRedisService>;
  const email = 'test@example.com';

  beforeEach(() => {
    redis = mockRedisService();
    service = new AccountLockoutService(redis as never);
  });

  it('should count failed attempts', async () => {
    const count1 = await service.recordFailedAttempt(email);
    expect(count1).toBe(1);

    const count2 = await service.recordFailedAttempt(email);
    expect(count2).toBe(2);
  });

  it('should not report locked until 5 attempts', async () => {
    for (let i = 0; i < 4; i++) {
      await service.recordFailedAttempt(email);
    }
    expect(await service.isLocked(email)).toBe(false);
  });

  it('should report locked at 5 attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await service.recordFailedAttempt(email);
    }
    expect(await service.isLocked(email)).toBe(true);
  });

  it('should set TTL on lockout counter', async () => {
    await service.recordFailedAttempt(email);
    expect(redis.expire).toHaveBeenCalledWith(
      `lockout:${email}`,
      1800, // 30 minutes
    );
  });

  it('should reset attempts on success', async () => {
    for (let i = 0; i < 3; i++) {
      await service.recordFailedAttempt(email);
    }

    await service.resetAttempts(email);
    expect(await service.isLocked(email)).toBe(false);
  });

  it('should report not locked when no attempts recorded', async () => {
    expect(await service.isLocked(email)).toBe(false);
  });
});
