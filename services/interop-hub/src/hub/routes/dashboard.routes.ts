import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authAndTenant, hubReadRoles } from '../auth';
import { qs, getUser } from '../helpers';

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/dashboard';

  // ── GET /dashboard/overview — KPIs ──
  app.get(`${prefix}/overview`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const tenantId = user.tenantId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      activeConnections,
      totalConnections,
      activePipelines,
      transactionsToday,
      failedToday,
      pendingReview,
    ] = await Promise.all([
      app.prisma.hubConnection.count({ where: { tenant_id: tenantId, status: 'ACTIVE' } }),
      app.prisma.hubConnection.count({ where: { tenant_id: tenantId } }),
      app.prisma.hubPipeline.count({ where: { tenant_id: tenantId, status: 'ACTIVE' } }),
      app.prisma.hubTransaction.count({ where: { tenant_id: tenantId, created_at: { gte: todayStart } } }),
      app.prisma.hubTransaction.count({ where: { tenant_id: tenantId, status: 'FAILED', created_at: { gte: todayStart } } }),
      app.prisma.hubTransaction.count({ where: { tenant_id: tenantId, status: 'AWAITING_REVIEW' } }),
    ]);

    const errorRate = transactionsToday > 0 ? Math.round((failedToday / transactionsToday) * 10000) / 100 : 0;

    return {
      data: {
        active_connections: activeConnections,
        total_connections: totalConnections,
        active_pipelines: activePipelines,
        transactions_today: transactionsToday,
        failed_today: failedToday,
        pending_review: pendingReview,
        error_rate: errorRate,
      },
    };
  });

  // ── GET /dashboard/volume — Transaction volume over time ──
  app.get(`${prefix}/volume`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const period = qs(request, 'period') ?? '30d';
    const groupBy = qs(request, 'groupBy') ?? 'day';

    // Calculate date range
    const now = new Date();
    let daysBack = 30;
    if (period === '7d') daysBack = 7;
    else if (period === '90d') daysBack = 90;
    const dateFrom = new Date(now.getTime() - daysBack * 86400000);

    // Use raw query for date grouping
    let dateTrunc = 'day';
    if (groupBy === 'week') dateTrunc = 'week';
    else if (groupBy === 'month') dateTrunc = 'month';

    const volume = await app.prisma.$queryRawUnsafe<
      Array<{ period: Date; inbound: bigint; outbound: bigint; total: bigint }>
    >(
      `SELECT
         date_trunc($1, created_at) as period,
         COUNT(*) FILTER (WHERE direction = 'INBOUND') as inbound,
         COUNT(*) FILTER (WHERE direction = 'OUTBOUND') as outbound,
         COUNT(*) as total
       FROM interop.hub_transactions
       WHERE tenant_id = $2::uuid AND created_at >= $3
       GROUP BY 1 ORDER BY 1`,
      dateTrunc,
      user.tenantId,
      dateFrom,
    );

    return {
      data: volume.map((v) => ({
        period: v.period,
        inbound: Number(v.inbound),
        outbound: Number(v.outbound),
        total: Number(v.total),
      })),
    };
  });

  // ── GET /dashboard/status — Transaction counts by status ──
  app.get(`${prefix}/status`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);

    const statusCounts = await app.prisma.hubTransaction.groupBy({
      by: ['status'],
      where: { tenant_id: user.tenantId },
      _count: { id: true },
    });

    return {
      data: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    };
  });

  // ── GET /dashboard/connections — Per-connection stats ──
  app.get(`${prefix}/connections`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);

    const connections = await app.prisma.hubConnection.findMany({
      where: { tenant_id: user.tenantId },
      select: {
        id: true,
        name: true,
        country_code: true,
        system_type: true,
        direction: true,
        status: true,
        last_health_ok: true,
        last_health_at: true,
        total_transactions: true,
        total_records: true,
        total_errors: true,
        last_transaction_at: true,
      },
      orderBy: { last_transaction_at: { sort: 'desc', nulls: 'last' } },
    });

    // Compute success rate and avg latency per connection
    const stats = await Promise.all(
      connections.map(async (c) => {
        const [completed, total, avgDuration] = await Promise.all([
          app.prisma.hubTransaction.count({ where: { connection_id: c.id, status: 'COMPLETED' } }),
          app.prisma.hubTransaction.count({ where: { connection_id: c.id } }),
          app.prisma.hubTransaction.aggregate({ where: { connection_id: c.id, duration_ms: { not: null } }, _avg: { duration_ms: true } }),
        ]);

        return {
          ...c,
          success_rate: total > 0 ? Math.round((completed / total) * 10000) / 100 : null,
          avg_latency_ms: avgDuration._avg.duration_ms ? Math.round(avgDuration._avg.duration_ms) : null,
        };
      }),
    );

    return { data: stats };
  });

  // ── GET /dashboard/domains — Per-domain stats ──
  app.get(`${prefix}/domains`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);

    const domainStats = await app.prisma.hubTransaction.groupBy({
      by: ['domain', 'direction'],
      where: { tenant_id: user.tenantId },
      _count: { id: true },
    });

    // Also get domain-level success/failure
    const domainStatusCounts = await app.prisma.hubTransaction.groupBy({
      by: ['domain', 'status'],
      where: { tenant_id: user.tenantId },
      _count: { id: true },
    });

    // Pivot into per-domain summaries
    const domainMap = new Map<string, {
      domain: string;
      inbound: number;
      outbound: number;
      completed: number;
      failed: number;
      total: number;
    }>();

    for (const row of domainStats) {
      const entry = domainMap.get(row.domain) ?? { domain: row.domain, inbound: 0, outbound: 0, completed: 0, failed: 0, total: 0 };
      if (row.direction === 'INBOUND') entry.inbound = row._count.id;
      else entry.outbound = row._count.id;
      entry.total += row._count.id;
      domainMap.set(row.domain, entry);
    }

    for (const row of domainStatusCounts) {
      const entry = domainMap.get(row.domain);
      if (!entry) continue;
      if (row.status === 'COMPLETED') entry.completed += row._count.id;
      if (row.status === 'FAILED') entry.failed += row._count.id;
    }

    return { data: Array.from(domainMap.values()) };
  });

  // ── GET /dashboard/health — All connection health statuses ──
  app.get(`${prefix}/health`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);

    const connections = await app.prisma.hubConnection.findMany({
      where: { tenant_id: user.tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        country_code: true,
        system_type: true,
        base_url: true,
        last_health_ok: true,
        last_health_at: true,
        health_message: true,
      },
    });

    return {
      data: connections.map((c) => ({
        connection_id: c.id,
        name: c.name,
        country_code: c.country_code,
        system_type: c.system_type,
        base_url: c.base_url,
        status: c.last_health_ok ? 'UP' : (c.last_health_at ? 'DOWN' : 'UNKNOWN'),
        last_checked: c.last_health_at,
        message: c.health_message,
      })),
    };
  });

  // ── GET /dashboard/recent — Recent transactions (last 50) ──
  app.get(`${prefix}/recent`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);

    const transactions = await app.prisma.hubTransaction.findMany({
      where: { tenant_id: user.tenantId },
      take: 50,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        direction: true,
        status: true,
        domain: true,
        entity_type: true,
        country_code: true,
        records_total: true,
        records_accepted: true,
        records_rejected: true,
        duration_ms: true,
        created_at: true,
        connection: { select: { id: true, name: true } },
      },
    });

    return { data: transactions };
  });

  // ── GET /dashboard/errors — Recent errors (last 50) ──
  app.get(`${prefix}/errors`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);

    const errors = await app.prisma.hubTransaction.findMany({
      where: {
        tenant_id: user.tenantId,
        status: { in: ['FAILED', 'PARTIAL'] },
      },
      take: 50,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        direction: true,
        status: true,
        domain: true,
        entity_type: true,
        country_code: true,
        error_message: true,
        current_step: true,
        retry_count: true,
        max_retries: true,
        created_at: true,
        connection: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true } },
      },
    });

    return { data: errors };
  });
}
