import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createMockHealthEvent,
  createMockTenantTree,
  createMockJwtPayload,
} from '@aris/test-utils';
import { UserRole, TenantLevel } from '@aris/shared-types';
import { startPgAndRedis, stopAllContainers } from '../setup/test-infrastructure';
import type { PostgresContainerResult, RedisContainerResult } from '@aris/test-utils';
import Redis from 'ioredis';

describe('Flux B: Collecte → Kafka → Analytics → Redis', () => {
  let postgres: PostgresContainerResult;
  let redis: RedisContainerResult;
  let redisClient: Redis;

  beforeAll(async () => {
    const infra = await startPgAndRedis();
    postgres = infra.postgres;
    redis = infra.redis;

    redisClient = new Redis(redis.redisUrl);
  });

  afterAll(async () => {
    await redisClient.quit();
    await stopAllContainers({ postgres, redis });
  });

  it('should connect to Redis container', async () => {
    const pong = await redisClient.ping();
    expect(pong).toBe('PONG');
  });

  it('should simulate health event analytics aggregation in Redis', async () => {
    const tree = createMockTenantTree({ recCount: 1, msPerRec: 1 });
    const msTenant = tree.memberStates[0];

    const event = createMockHealthEvent({
      tenantId: msTenant.id,
      countryCode: 'KE',
      diseaseCode: 'FMD',
      status: 'CONFIRMED',
      affectedCount: 150,
      deadCount: 12,
    });

    // Simulate analytics aggregation storing data in Redis
    const redisKey = `aris:analytics:health:${msTenant.id}:active`;
    const casesKey = `aris:analytics:health:${msTenant.id}:cases`;
    const deathsKey = `aris:analytics:health:${msTenant.id}:deaths`;

    await redisClient.incr(redisKey);
    await redisClient.incrby(casesKey, event.affectedCount);
    await redisClient.incrby(deathsKey, event.deadCount);

    // Verify Redis state
    const activeCount = await redisClient.get(redisKey);
    expect(Number(activeCount)).toBe(1);

    const totalCases = await redisClient.get(casesKey);
    expect(Number(totalCases)).toBe(150);

    const totalDeaths = await redisClient.get(deathsKey);
    expect(Number(totalDeaths)).toBe(12);
  });

  it('should accumulate counts for multiple events', async () => {
    const tenantId = crypto.randomUUID();
    const redisKey = `aris:analytics:health:${tenantId}:events`;

    const events = [
      createMockHealthEvent({ tenantId, affectedCount: 100, deadCount: 5 }),
      createMockHealthEvent({ tenantId, affectedCount: 200, deadCount: 10 }),
      createMockHealthEvent({ tenantId, affectedCount: 50, deadCount: 3 }),
    ];

    for (const event of events) {
      await redisClient.incrby(`${redisKey}:cases`, event.affectedCount);
      await redisClient.incrby(`${redisKey}:deaths`, event.deadCount);
      await redisClient.incr(`${redisKey}:count`);
    }

    const totalCases = await redisClient.get(`${redisKey}:cases`);
    const totalDeaths = await redisClient.get(`${redisKey}:deaths`);
    const totalCount = await redisClient.get(`${redisKey}:count`);

    expect(Number(totalCases)).toBe(350);
    expect(Number(totalDeaths)).toBe(18);
    expect(Number(totalCount)).toBe(3);
  });

  it('should track quality validation pass/fail rates', async () => {
    const tenantId = crypto.randomUUID();
    const qualityKey = `aris:analytics:quality:${tenantId}`;

    // Simulate 7 passes and 3 failures
    for (let i = 0; i < 7; i++) {
      await redisClient.hincrby(qualityKey, 'passed', 1);
    }
    for (let i = 0; i < 3; i++) {
      await redisClient.hincrby(qualityKey, 'failed', 1);
    }

    const passed = Number(await redisClient.hget(qualityKey, 'passed'));
    const failed = Number(await redisClient.hget(qualityKey, 'failed'));
    const total = passed + failed;
    const passRate = passed / total;

    expect(passed).toBe(7);
    expect(failed).toBe(3);
    expect(total).toBe(10);
    expect(passRate).toBeCloseTo(0.7);
  });

  it('should support TTL for cached analytics data', async () => {
    const cacheKey = `aris:analytics:cache:dashboard:test`;

    await redisClient.setex(cacheKey, 120, JSON.stringify({ total: 42 }));

    const ttl = await redisClient.ttl(cacheKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);

    const cached = await redisClient.get(cacheKey);
    expect(JSON.parse(cached!)).toEqual({ total: 42 });
  });
});
