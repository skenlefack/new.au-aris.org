import { describe, it, expect, beforeEach } from 'vitest';
import * as client from 'prom-client';
import { KafkaMetricsService } from '../kafka-metrics.service';

beforeEach(() => {
  client.register.clear();
});

describe('KafkaMetricsService', () => {
  let service: KafkaMetricsService;

  beforeEach(() => {
    service = new KafkaMetricsService();
  });

  it('should increment messages produced counter', async () => {
    service.recordMessageProduced('ms.health.outbreak.created.v1');
    service.recordMessageProduced('ms.health.outbreak.created.v1');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_kafka_messages_produced_total');
    expect(metrics).toContain('ms.health.outbreak.created.v1');
  });

  it('should increment messages consumed counter', async () => {
    service.recordMessageConsumed('ms.collecte.form.submitted.v1', 'collecte-group');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_kafka_messages_consumed_total');
    expect(metrics).toContain('collecte-group');
  });

  it('should increment failed messages counter', async () => {
    service.recordMessageFailed('dlq.all.v1', 'processor-group');

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_kafka_messages_failed_total');
  });

  it('should set consumer lag gauge', async () => {
    service.setConsumerLag('ms.health.outbreak.created.v1', 'health-group', 0, 42);

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_kafka_consumer_lag');
    expect(metrics).toContain('42');
  });

  it('should provide produce timer', async () => {
    const end = service.startProduceTimer('sys.tenant.created.v1');
    end();

    const metrics = await client.register.metrics();
    expect(metrics).toContain('aris_kafka_produce_duration_seconds');
  });
});
