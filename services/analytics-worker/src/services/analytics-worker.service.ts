import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import {
  TOPIC_AU_ANALYTICS_METRIC_CALCULATED,
  TOPIC_AU_ANALYTICS_AGGREGATION_COMPLETED,
} from '@aris/shared-types';
import type { KpiQuery, AggregateRequest, DashboardQuery, WorkerStateQuery } from '../schemas/analytics.schema';

const SERVICE_NAME = 'analytics-worker-service';
const CACHE_TTL = 120; // 2 min for CQRS reads
const CACHE_PREFIX = 'aris:analytics:kpis';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// ── Tumbling Window helpers ──
export function getPeriodBounds(periodType: string, date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  switch (periodType) {
    case 'DAILY': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + 86400_000);
      return { start, end };
    }
    case 'WEEKLY': {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const start = new Date(d.getFullYear(), d.getMonth(), diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 7 * 86400_000);
      return { start, end };
    }
    case 'MONTHLY': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return { start, end };
    }
    case 'QUARTERLY': {
      const quarter = Math.floor(d.getMonth() / 3);
      const start = new Date(d.getFullYear(), quarter * 3, 1);
      const end = new Date(d.getFullYear(), quarter * 3 + 3, 1);
      return { start, end };
    }
    case 'YEARLY': {
      const start = new Date(d.getFullYear(), 0, 1);
      const end = new Date(d.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    default:
      return getPeriodBounds('MONTHLY', date);
  }
}

export class AnalyticsWorkerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  // ── Upsert a metric (idempotent) ──
  async upsertMetric(
    tenantId: string,
    domain: string,
    metricName: string,
    metricType: string,
    periodType: string,
    value: number,
    dimensions?: Record<string, unknown>,
  ): Promise<void> {
    const { start, end } = getPeriodBounds(periodType);

    await (this.prisma as any).aggregateMetric.upsert({
      where: {
        uq_aggregate_metric: {
          tenant_id: tenantId,
          domain,
          metric_name: metricName,
          metric_type: metricType,
          period_type: periodType,
          period_start: start,
        },
      },
      update: {
        value: { increment: value },
        dimensions: dimensions ?? undefined,
      },
      create: {
        id: randomUUID(),
        tenant_id: tenantId,
        domain,
        metric_name: metricName,
        metric_type: metricType,
        period_type: periodType,
        period_start: start,
        period_end: end,
        value,
        dimensions: dimensions ?? undefined,
      },
    });

    // Invalidate cache
    await this.invalidateDomainCache(tenantId, domain);
  }

  // ── Process incoming domain event ──
  async processEvent(
    domain: string,
    eventType: string,
    payload: Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    const periodTypes = ['DAILY', 'WEEKLY', 'MONTHLY'];

    for (const periodType of periodTypes) {
      // Count metric
      await this.upsertMetric(tenantId, domain, `${eventType}_count`, 'COUNT', periodType, 1);

      // Numeric aggregates
      for (const [key, val] of Object.entries(payload)) {
        if (typeof val === 'number') {
          await this.upsertMetric(tenantId, domain, `${eventType}_${key}_sum`, 'SUM', periodType, val);
        }
      }
    }

    // Publish calculated event
    await this.publishEvent(TOPIC_AU_ANALYTICS_METRIC_CALCULATED, randomUUID(), {
      domain,
      eventType,
      tenantId,
      processedAt: new Date().toISOString(),
    }, tenantId);
  }

  // ── Hierarchical aggregation: country → REC → continental ──
  async aggregateHierarchically(
    domain: string,
    periodType: string,
    parentTenantId: string,
    childTenantIds: string[],
  ): Promise<void> {
    // Sum up child metrics to parent
    const childMetrics = await (this.prisma as any).aggregateMetric.findMany({
      where: {
        domain,
        period_type: periodType,
        tenant_id: { in: childTenantIds },
      },
    });

    // Group by metric_name + metric_type
    const grouped = new Map<string, number>();
    for (const m of childMetrics) {
      const key = `${m.metric_name}:${m.metric_type}`;
      grouped.set(key, (grouped.get(key) ?? 0) + m.value);
    }

    for (const [key, totalValue] of grouped) {
      const [metricName, metricType] = key.split(':');
      await this.upsertMetric(parentTenantId, domain, metricName, metricType, periodType, totalValue);
    }
  }

  // ── Trigger aggregation for requested domains ──
  async triggerAggregation(request: AggregateRequest, tenantId: string, userId: string) {
    const periodType = request.periodType ?? 'MONTHLY';
    const results: Array<{ domain: string; metricsCount: number }> = [];

    for (const domain of request.domains) {
      if (request.force) {
        // Delete existing metrics for this period and re-count
        const { start, end } = getPeriodBounds(periodType);
        await (this.prisma as any).aggregateMetric.deleteMany({
          where: {
            tenant_id: tenantId,
            domain,
            period_type: periodType,
            period_start: start,
            period_end: end,
          },
        });
      }

      const count = await (this.prisma as any).aggregateMetric.count({
        where: { tenant_id: tenantId, domain, period_type: periodType },
      });

      results.push({ domain, metricsCount: count });
      await this.invalidateDomainCache(tenantId, domain);
    }

    await this.publishEvent(TOPIC_AU_ANALYTICS_AGGREGATION_COMPLETED, randomUUID(), {
      domains: request.domains,
      periodType,
      results,
      triggeredBy: userId,
      completedAt: new Date().toISOString(),
    }, tenantId);

    return {
      data: {
        jobId: randomUUID(),
        domains: request.domains,
        periodType,
        results,
        triggeredBy: userId,
        completedAt: new Date().toISOString(),
      },
    };
  }

  // ── Query metrics ──
  async getMetrics(query: KpiQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.domain) where.domain = query.domain;
    if (query.periodType) where.period_type = query.periodType;
    if (query.tenantId) where.tenant_id = query.tenantId;

    // Try cache first
    const cacheKey = `${CACHE_PREFIX}:query:${JSON.stringify({ ...query, page, limit })}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [data, total] = await Promise.all([
      (this.prisma as any).aggregateMetric.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updated_at: 'desc' },
      }),
      (this.prisma as any).aggregateMetric.count({ where }),
    ]);

    const result = { data, meta: { total, page, limit } };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  }

  // ── Domain metrics (single domain) ──
  async getDomainMetrics(domain: string, tenantId: string) {
    const cacheKey = `${CACHE_PREFIX}:domain:${tenantId}:${domain}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { data: JSON.parse(cached) };

    const metrics = await (this.prisma as any).aggregateMetric.findMany({
      where: { domain, tenant_id: tenantId },
      orderBy: { period_start: 'desc' },
      take: 50,
    });

    if (metrics.length === 0) throw new HttpError(404, `No metrics found for domain: ${domain}`);

    await this.redis.set(cacheKey, JSON.stringify(metrics), 'EX', CACHE_TTL);
    return { data: metrics };
  }

  // ── Dashboard ──
  async getDashboard(tenantId: string, query: DashboardQuery) {
    const periodType = query.periodType ?? 'MONTHLY';
    const { start, end } = getPeriodBounds(periodType);

    const metrics = await (this.prisma as any).aggregateMetric.findMany({
      where: {
        tenant_id: tenantId,
        period_type: periodType,
        period_start: { gte: start },
        period_end: { lte: end },
      },
    });

    // Group by domain
    const domainMap = new Map<string, { count: number; totalValue: number; metrics: number }>();
    for (const m of metrics) {
      const entry = domainMap.get(m.domain) ?? { count: 0, totalValue: 0, metrics: 0 };
      entry.count += m.metric_type === 'COUNT' ? m.value : 0;
      entry.totalValue += m.value;
      entry.metrics += 1;
      domainMap.set(m.domain, entry);
    }

    const domains = Array.from(domainMap.entries()).map(([domain, stats]) => ({
      domain,
      ...stats,
    }));

    return {
      data: {
        tenantId,
        periodType,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        domains,
        summary: {
          totalMetrics: metrics.length,
          domainCount: domains.length,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // ── Worker State ──
  async saveWorkerState(
    consumerGroup: string,
    topic: string,
    partition: number,
    offset: string,
  ): Promise<void> {
    await (this.prisma as any).workerState.upsert({
      where: {
        uq_worker_state: { consumer_group: consumerGroup, topic, partition },
      },
      update: {
        last_offset: offset,
        last_processed_at: new Date(),
        records_processed: { increment: 1 },
      },
      create: {
        id: randomUUID(),
        consumer_group: consumerGroup,
        topic,
        partition,
        last_offset: offset,
        last_processed_at: new Date(),
        records_processed: 1,
      },
    });
  }

  async recordWorkerError(consumerGroup: string, topic: string, partition: number, error: string): Promise<void> {
    await (this.prisma as any).workerState.upsert({
      where: {
        uq_worker_state: { consumer_group: consumerGroup, topic, partition },
      },
      update: {
        error_count: { increment: 1 },
        last_error: error,
      },
      create: {
        id: randomUUID(),
        consumer_group: consumerGroup,
        topic,
        partition,
        last_offset: '0',
        last_processed_at: new Date(),
        error_count: 1,
        last_error: error,
      },
    });
  }

  async getWorkerStates(query: WorkerStateQuery) {
    const where: any = {};
    if (query.consumerGroup) where.consumer_group = query.consumerGroup;

    const states = await (this.prisma as any).workerState.findMany({
      where,
      orderBy: { updated_at: 'desc' },
    });

    return { data: states };
  }

  // ── Cache invalidation ──
  private async invalidateDomainCache(tenantId: string, domain: string): Promise<void> {
    const patterns = [
      `${CACHE_PREFIX}:domain:${tenantId}:${domain}`,
      `${CACHE_PREFIX}:query:*`,
    ];
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) await this.redis.del(...keys);
      } else {
        await this.redis.del(pattern);
      }
    }
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId: 'system',
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch {}
  }
}
