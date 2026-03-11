import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KAFKA_CONFIG,
  KAFKA_CONFIG_TOKEN,
  KAFKA_INSTANCE_TOKEN,
} from '../kafka.config';

describe('kafka.config', () => {
  it('should have correct retry defaults', () => {
    expect(DEFAULT_KAFKA_CONFIG.retry).toEqual({
      maxRetries: 5,
      initialRetryTime: 300,
      maxRetryTime: 30000,
      factor: 2,
    });
  });

  it('should have correct producer defaults', () => {
    expect(DEFAULT_KAFKA_CONFIG.producer).toEqual({
      idempotent: true,
      maxInFlightRequests: 1,
      transactionTimeout: 30000,
    });
  });

  it('should have correct consumer defaults', () => {
    expect(DEFAULT_KAFKA_CONFIG.consumer).toEqual({
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576,
    });
  });

  it('should export KAFKA_CONFIG_TOKEN and KAFKA_INSTANCE_TOKEN', () => {
    expect(typeof KAFKA_CONFIG_TOKEN).toBe('string');
    expect(typeof KAFKA_INSTANCE_TOKEN).toBe('string');
    expect(KAFKA_CONFIG_TOKEN).toBe('ARIS_KAFKA_CONFIG');
    expect(KAFKA_INSTANCE_TOKEN).toBe('ARIS_KAFKA_INSTANCE');
  });
});
