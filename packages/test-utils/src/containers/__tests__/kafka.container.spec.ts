import { describe, it, expect, afterAll } from 'vitest';
import { startKafkaContainer, type KafkaContainerResult } from '../kafka.container';

describe('startKafkaContainer', () => {
  let kafka: KafkaContainerResult | undefined;

  afterAll(async () => {
    if (kafka) {
      await kafka.container.stop();
    }
  });

  it('should start a Kafka KRaft container and return broker details', async () => {
    kafka = await startKafkaContainer();

    expect(kafka.container).toBeDefined();
    expect(kafka.brokerUrl).toBeDefined();
    expect(kafka.host).toBeDefined();
    expect(typeof kafka.port).toBe('number');
    expect(kafka.port).toBeGreaterThan(0);
  });

  it('should return a valid broker URL', async () => {
    if (!kafka) {
      kafka = await startKafkaContainer();
    }

    expect(kafka.brokerUrl).toBe(`${kafka.host}:${kafka.port}`);
  });
});
