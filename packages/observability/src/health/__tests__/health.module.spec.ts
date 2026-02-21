import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PostgresHealthIndicator,
  RedisHealthIndicator,
  KafkaHealthIndicator,
} from '../health.module';

describe('PostgresHealthIndicator', () => {
  let indicator: PostgresHealthIndicator;

  beforeEach(() => {
    indicator = new PostgresHealthIndicator();
  });

  it('should return unhealthy when prisma is not configured', async () => {
    const result = await indicator.isHealthy('database');
    expect(result['database'].status).toBe('down');
  });

  it('should return healthy when query succeeds', async () => {
    const mockPrisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    indicator.setPrisma(mockPrisma);

    const result = await indicator.isHealthy('database');
    expect(result['database'].status).toBe('up');
  });

  it('should return unhealthy when query fails', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
    };
    indicator.setPrisma(mockPrisma);

    const result = await indicator.isHealthy('database');
    expect(result['database'].status).toBe('down');
    expect(result['database']['message']).toContain('Connection refused');
  });
});

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(() => {
    indicator = new RedisHealthIndicator();
  });

  it('should return unhealthy when redis is not configured', async () => {
    const result = await indicator.isHealthy('redis');
    expect(result['redis'].status).toBe('down');
  });

  it('should return healthy when get succeeds', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(null) };
    indicator.setRedis(mockRedis);

    const result = await indicator.isHealthy('redis');
    expect(result['redis'].status).toBe('up');
  });

  it('should return unhealthy when get fails', async () => {
    const mockRedis = {
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    indicator.setRedis(mockRedis);

    const result = await indicator.isHealthy('redis');
    expect(result['redis'].status).toBe('down');
  });
});

describe('KafkaHealthIndicator', () => {
  let indicator: KafkaHealthIndicator;

  beforeEach(() => {
    indicator = new KafkaHealthIndicator();
  });

  it('should return healthy when no check fn is configured', async () => {
    const result = await indicator.isHealthy('kafka');
    expect(result['kafka'].status).toBe('up');
  });

  it('should return healthy when check fn returns true', async () => {
    indicator.setCheckFn(async () => true);

    const result = await indicator.isHealthy('kafka');
    expect(result['kafka'].status).toBe('up');
  });

  it('should return unhealthy when check fn returns false', async () => {
    indicator.setCheckFn(async () => false);

    const result = await indicator.isHealthy('kafka');
    expect(result['kafka'].status).toBe('down');
  });

  it('should return unhealthy when check fn throws', async () => {
    indicator.setCheckFn(async () => {
      throw new Error('Broker unreachable');
    });

    const result = await indicator.isHealthy('kafka');
    expect(result['kafka'].status).toBe('down');
    expect(result['kafka']['message']).toContain('Broker unreachable');
  });
});
