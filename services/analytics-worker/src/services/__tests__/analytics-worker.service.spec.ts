import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsWorkerService, getPeriodBounds } from '../analytics-worker.service';

// ── Mocks ──
function createMockPrisma() {
  return {
    aggregateMetric: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    workerState: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  };
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

describe('AnalyticsWorkerService', () => {
  let service: AnalyticsWorkerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let kafka: ReturnType<typeof createMockKafka>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    kafka = createMockKafka();
    service = new AnalyticsWorkerService(prisma as any, redis as any, kafka as any);
  });

  // ── 1. Period bounds: DAILY ──
  it('should calculate DAILY period bounds correctly', () => {
    const date = new Date('2026-03-15T14:30:00Z');
    const { start, end } = getPeriodBounds('DAILY', date);

    expect(start.getDate()).toBe(15);
    expect(end.getDate()).toBe(16);
  });

  // ── 2. Period bounds: MONTHLY ──
  it('should calculate MONTHLY period bounds correctly', () => {
    const date = new Date('2026-06-15T14:30:00Z');
    const { start, end } = getPeriodBounds('MONTHLY', date);

    expect(start.getMonth()).toBe(5); // June (0-indexed)
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(6); // July
    expect(end.getDate()).toBe(1);
  });

  // ── 3. Period bounds: QUARTERLY ──
  it('should calculate QUARTERLY period bounds correctly', () => {
    const date = new Date('2026-08-15T00:00:00Z');
    const { start, end } = getPeriodBounds('QUARTERLY', date);

    expect(start.getMonth()).toBe(6); // Q3 starts July
    expect(end.getMonth()).toBe(9);   // Q4 starts October
  });

  // ── 4. Upsert metric (idempotent) ──
  it('should upsert metric with correct tumbling window', async () => {
    await service.upsertMetric(TENANT_ID, 'health', 'outbreak_count', 'COUNT', 'MONTHLY', 1);

    expect(prisma.aggregateMetric.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.aggregateMetric.upsert.mock.calls[0][0];
    expect(call.where.uq_aggregate_metric.domain).toBe('health');
    expect(call.where.uq_aggregate_metric.metric_name).toBe('outbreak_count');
    expect(call.update.value.increment).toBe(1);
  });

  // ── 5. Process event creates metrics for all period types ──
  it('should create metrics for DAILY, WEEKLY, and MONTHLY on event processing', async () => {
    await service.processEvent('health', 'outbreak', { cases: 10 }, TENANT_ID);

    // Should call upsert for count (3 periods) + numeric aggregate for "cases" (3 periods)
    expect(prisma.aggregateMetric.upsert.mock.calls.length).toBeGreaterThanOrEqual(6);
    // Should publish calculated event
    expect(kafka.send).toHaveBeenCalledTimes(1);
  });

  // ── 6. Hierarchical aggregation ──
  it('should aggregate child tenant metrics to parent', async () => {
    const childMetrics = [
      { metric_name: 'outbreak_count', metric_type: 'COUNT', value: 10, domain: 'health' },
      { metric_name: 'outbreak_count', metric_type: 'COUNT', value: 20, domain: 'health' },
      { metric_name: 'cases_sum', metric_type: 'SUM', value: 50, domain: 'health' },
    ];
    prisma.aggregateMetric.findMany.mockResolvedValue(childMetrics);

    const parentTenant = '44444444-4444-4444-4444-444444444444';
    const childTenants = ['child-1', 'child-2'];

    await service.aggregateHierarchically('health', 'MONTHLY', parentTenant, childTenants);

    // Should upsert 2 distinct metrics to parent: outbreak_count (30) and cases_sum (50)
    expect(prisma.aggregateMetric.upsert.mock.calls.length).toBe(2);
  });

  // ── 7. Query metrics with pagination ──
  it('should return paginated metrics', async () => {
    const metrics = [{ id: '1', domain: 'health', value: 42 }];
    prisma.aggregateMetric.findMany.mockResolvedValue(metrics);
    prisma.aggregateMetric.count.mockResolvedValue(1);

    const result = await service.getMetrics({ domain: 'health', page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  // ── 8. Query metrics uses cache ──
  it('should return cached metrics when available', async () => {
    const cached = { data: [{ id: '1' }], meta: { total: 1, page: 1, limit: 20 } };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getMetrics({});

    expect(result).toEqual(cached);
    expect(prisma.aggregateMetric.findMany).not.toHaveBeenCalled();
  });

  // ── 9. Domain metrics 404 ──
  it('should throw 404 when no metrics for domain', async () => {
    prisma.aggregateMetric.findMany.mockResolvedValue([]);

    await expect(service.getDomainMetrics('unknown', TENANT_ID)).rejects.toThrow('No metrics found for domain');
  });

  // ── 10. Dashboard aggregation ──
  it('should return dashboard with domain breakdown', async () => {
    const metrics = [
      { domain: 'health', metric_type: 'COUNT', value: 10 },
      { domain: 'health', metric_type: 'SUM', value: 50 },
      { domain: 'livestock', metric_type: 'COUNT', value: 5 },
    ];
    prisma.aggregateMetric.findMany.mockResolvedValue(metrics);

    const result = await service.getDashboard(TENANT_ID, { periodType: 'MONTHLY' });

    expect(result.data.domains).toHaveLength(2);
    expect(result.data.summary.totalMetrics).toBe(3);
    expect(result.data.summary.domainCount).toBe(2);
  });

  // ── 11. Trigger aggregation ──
  it('should trigger aggregation and publish completion event', async () => {
    prisma.aggregateMetric.count.mockResolvedValue(5);

    const result = await service.triggerAggregation(
      { domains: ['health', 'livestock'] },
      TENANT_ID,
      'user-1',
    );

    expect(result.data.domains).toEqual(['health', 'livestock']);
    expect(result.data.results).toHaveLength(2);
    expect(kafka.send).toHaveBeenCalledTimes(1); // aggregation.completed event
  });

  // ── 12. Force aggregation deletes existing ──
  it('should delete existing metrics when force=true', async () => {
    prisma.aggregateMetric.count.mockResolvedValue(0);

    await service.triggerAggregation(
      { domains: ['health'], force: true },
      TENANT_ID,
      'user-1',
    );

    expect(prisma.aggregateMetric.deleteMany).toHaveBeenCalledTimes(1);
  });

  // ── 13. Worker state tracking ──
  it('should save worker state with offset', async () => {
    await service.saveWorkerState('analytics-worker-health', 'ms.health.event.created.v1', 0, '42');

    expect(prisma.workerState.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.workerState.upsert.mock.calls[0][0];
    expect(call.where.uq_worker_state.consumer_group).toBe('analytics-worker-health');
    expect(call.update.last_offset).toBe('42');
  });

  // ── 14. Worker error tracking ──
  it('should record worker errors', async () => {
    await service.recordWorkerError('analytics-worker-health', 'topic', 0, 'Parse error');

    expect(prisma.workerState.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.workerState.upsert.mock.calls[0][0];
    expect(call.update.error_count.increment).toBe(1);
    expect(call.update.last_error).toBe('Parse error');
  });

  // ── 15. Get worker states ──
  it('should return worker states filtered by consumer group', async () => {
    const states = [{ id: '1', consumer_group: 'analytics-worker-health', records_processed: 100 }];
    prisma.workerState.findMany.mockResolvedValue(states);

    const result = await service.getWorkerStates({ consumerGroup: 'analytics-worker-health' });

    expect(result.data).toHaveLength(1);
    expect(prisma.workerState.findMany).toHaveBeenCalledWith({
      where: { consumer_group: 'analytics-worker-health' },
      orderBy: { updated_at: 'desc' },
    });
  });

  // ── 16. Period bounds: YEARLY ──
  it('should calculate YEARLY period bounds', () => {
    const date = new Date('2026-06-15T00:00:00Z');
    const { start, end } = getPeriodBounds('YEARLY', date);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(0);
    expect(end.getFullYear()).toBe(2027);
  });

  // ── 17. Cache invalidation on upsert ──
  it('should invalidate cache when upserting metrics', async () => {
    await service.upsertMetric(TENANT_ID, 'health', 'count', 'COUNT', 'DAILY', 1);

    expect(redis.del).toHaveBeenCalled();
  });
});
