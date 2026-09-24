/**
 * Admin routes — SUPER_ADMIN only endpoints for:
 * - Infrastructure monitoring (services health, Postgres, Redis, Kafka)
 * - Runtime configuration (feature flags, rate limits, Kafka topics)
 * - Maintenance mode (toggle, schedule windows)
 * - Bulk import / export
 * - System metrics
 */
import type { FastifyInstance } from 'fastify';
import { rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';

// ── Service registry (must match docker-compose) ──

const SERVICE_REGISTRY = [
  { name: 'tenant', port: 3001, group: 'Platform' },
  { name: 'credential', port: 3002, group: 'Platform' },
  { name: 'message', port: 3006, group: 'Platform' },
  { name: 'drive', port: 3007, group: 'Platform' },
  { name: 'realtime', port: 3008, group: 'Platform' },
  { name: 'master-data', port: 3003, group: 'Data Hub' },
  { name: 'data-quality', port: 3004, group: 'Data Hub' },
  { name: 'data-contract', port: 3005, group: 'Data Hub' },
  { name: 'interop-hub', port: 3032, group: 'Data Hub' },
  { name: 'form-builder', port: 3010, group: 'Collecte & Workflow' },
  { name: 'collecte', port: 3011, group: 'Collecte & Workflow' },
  { name: 'workflow', port: 3012, group: 'Collecte & Workflow' },
  { name: 'animal-health', port: 3020, group: 'Domain Services' },
  { name: 'livestock-prod', port: 3021, group: 'Domain Services' },
  { name: 'fisheries', port: 3022, group: 'Domain Services' },
  { name: 'wildlife', port: 3023, group: 'Domain Services' },
  { name: 'apiculture', port: 3024, group: 'Domain Services' },
  { name: 'trade-sps', port: 3025, group: 'Domain Services' },
  { name: 'governance', port: 3026, group: 'Domain Services' },
  { name: 'climate-env', port: 3027, group: 'Domain Services' },
  { name: 'analytics', port: 3030, group: 'Data & Integration' },
  { name: 'geo-services', port: 3031, group: 'Data & Integration' },
];

async function fetchServiceHealth(name: string, port: number): Promise<any> {
  const container = `aris-${name}`;
  try {
    const res = await fetch(`http://${container}:${port}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { name, port, status: 'down', error: `HTTP ${res.status}` };
    const data = await res.json() as Record<string, unknown>;
    return { name, port, status: 'healthy', ...data };
  } catch {
    return { name, port, status: 'down', error: 'unreachable' };
  }
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const superAdminOnly = [app.authHookFn, rolesHook(UserRole.SUPER_ADMIN)];
  const prisma = app.prisma;
  const redis = (app as any).redis;

  // ═══════════════════════════════════════════════════════════════
  //  MONITORING — Infrastructure health
  // ═══════════════════════════════════════════════════════════════

  // GET /api/v1/admin/system/metrics — high-level KPIs
  app.get('/api/v1/admin/system/metrics', { preHandler: superAdminOnly }, async () => {
    const [userCount, tenantCount] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: bigint }]>('SELECT COUNT(*) as count FROM public.users').then(r => Number(r[0]?.count ?? 0)),
      prisma.$queryRawUnsafe<[{ count: bigint }]>('SELECT COUNT(*) as count FROM public.tenants').then(r => Number(r[0]?.count ?? 0)),
    ]);

    // Quick health check of all services
    const healthResults = await Promise.all(
      SERVICE_REGISTRY.map(s => fetchServiceHealth(s.name, s.port)),
    );
    const healthyCount = healthResults.filter(r => r.status === 'healthy').length;

    return {
      data: {
        totalUsers: userCount,
        totalTenants: tenantCount,
        healthyServices: healthyCount,
        totalServices: SERVICE_REGISTRY.length,
        kafkaLag: 0, // populated by kafka health service if available
      },
    };
  });

  // GET /api/v1/admin/services/health — per-service health
  app.get('/api/v1/admin/services/health', { preHandler: superAdminOnly }, async () => {
    const results = await Promise.all(
      SERVICE_REGISTRY.map(async (svc) => {
        const container = `aris-${svc.name}`;
        try {
          const start = Date.now();
          const res = await fetch(`http://${container}:${svc.port}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          const responseTime = Date.now() - start;
          if (!res.ok) {
            return { ...svc, status: 'down', responseTime, version: null, uptime: 0, memoryUsage: 0 };
          }
          // Try to get metrics for memory/uptime
          let uptime = 0;
          let memoryUsage = 0;
          let version = '1.0.0';
          try {
            const metricsRes = await fetch(`http://${container}:${svc.port}/metrics`, {
              signal: AbortSignal.timeout(2000),
            });
            if (metricsRes.ok) {
              const text = await metricsRes.text();
              const uptimeMatch = text.match(/process_uptime_seconds\{[^}]*\}\s+([\d.]+)/);
              const memMatch = text.match(/process_resident_memory_bytes\{[^}]*\}\s+([\d.]+)/);
              if (uptimeMatch) uptime = parseFloat(uptimeMatch[1]);
              if (memMatch) memoryUsage = parseInt(memMatch[1]);
            }
          } catch { /* metrics not available */ }
          return { ...svc, status: 'healthy', responseTime, version, uptime, memoryUsage };
        } catch {
          return { ...svc, status: 'down', responseTime: 0, version: null, uptime: 0, memoryUsage: 0 };
        }
      }),
    );
    return { data: results };
  });

  // GET /api/v1/admin/infra/health — Postgres + Redis + Kafka consumer lag
  app.get('/api/v1/admin/infra/health', { preHandler: superAdminOnly }, async () => {
    // Services health (quick)
    const services = await Promise.all(
      SERVICE_REGISTRY.map(async (svc) => {
        try {
          const res = await fetch(`http://aris-${svc.name}:${svc.port}/health`, {
            signal: AbortSignal.timeout(2000),
          });
          return { ...svc, status: res.ok ? 'healthy' : 'down' };
        } catch {
          return { ...svc, status: 'down' };
        }
      }),
    );

    // PostgreSQL pool stats
    let postgres = { activeConnections: 0, idleConnections: 0, maxConnections: 0, waitingRequests: 0, uptimeSeconds: 0 };
    try {
      const pgStats = await prisma.$queryRawUnsafe<any[]>(
        `SELECT numbackends as active, (SELECT setting::int FROM pg_settings WHERE name='max_connections') as max_conn,
         (SELECT extract(epoch from current_timestamp - pg_postmaster_start_time())) as uptime
         FROM pg_stat_database WHERE datname = current_database()`,
      );
      if (pgStats[0]) {
        postgres = {
          activeConnections: Number(pgStats[0].active ?? 0),
          idleConnections: 0,
          maxConnections: Number(pgStats[0].max_conn ?? 100),
          waitingRequests: 0,
          uptimeSeconds: Math.round(Number(pgStats[0].uptime ?? 0)),
        };
      }
    } catch { /* pg stats unavailable */ }

    // Redis stats
    let redisStats = { usedMemory: '0', connectedClients: 0, uptimeSeconds: 0, hitRate: '0%' };
    try {
      const info = await redis.info('memory');
      const memMatch = info.match(/used_memory_human:(\S+)/);
      const clientInfo = await redis.info('clients');
      const clientMatch = clientInfo.match(/connected_clients:(\d+)/);
      const serverInfo = await redis.info('server');
      const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
      const statsInfo = await redis.info('stats');
      const hitsMatch = statsInfo.match(/keyspace_hits:(\d+)/);
      const missMatch = statsInfo.match(/keyspace_misses:(\d+)/);
      const hits = parseInt(hitsMatch?.[1] ?? '0');
      const misses = parseInt(missMatch?.[1] ?? '0');
      const hitRate = hits + misses > 0 ? `${Math.round((hits / (hits + misses)) * 100)}%` : '0%';
      redisStats = {
        usedMemory: memMatch?.[1] ?? '0',
        connectedClients: parseInt(clientMatch?.[1] ?? '0'),
        uptimeSeconds: parseInt(uptimeMatch?.[1] ?? '0'),
        hitRate,
      };
    } catch { /* redis unavailable */ }

    // Kafka consumer lag — from kafka health service
    let kafkaConsumerGroups: any[] = [];
    try {
      const kafkaHealth = await (app as any).kafkaHealthService.getHealth();
      kafkaConsumerGroups = (kafkaHealth.consumers ?? []).map((c: any) => ({
        groupId: c.groupId,
        topic: c.partitions?.[0]?.topic ?? '',
        totalLag: c.totalLag,
        partitions: c.partitions ?? [],
      }));
    } catch { /* kafka unavailable */ }

    return {
      data: {
        services,
        kafka: { consumerGroups: kafkaConsumerGroups },
        postgres,
        redis: redisStats,
      },
    };
  });

  // ═══════════════════════════════════════════════════════════════
  //  CONFIGURATION — Feature flags, rate limits, Kafka topics
  // ═══════════════════════════════════════════════════════════════

  // GET /api/v1/admin/config/feature-flags
  app.get('/api/v1/admin/config/feature-flags', { preHandler: superAdminOnly }, async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, key, value, label, updated_at FROM governance.system_configs WHERE category = 'feature-flags' ORDER BY key`,
      );
      const flags = rows.map(r => ({
        id: r.id,
        key: r.key,
        description: typeof r.label === 'object' ? (r.label as any)?.en ?? r.key : r.key,
        enabled: r.value === true || r.value === 'true' || (typeof r.value === 'object' && (r.value as any)?.enabled === true),
        tenantOverrides: typeof r.value === 'object' ? ((r.value as any)?.overrides ?? {}) : {},
        updatedAt: r.updated_at,
      }));
      return { data: flags };
    } catch {
      return { data: [] };
    }
  });

  // PATCH /api/v1/admin/config/feature-flags/:id
  app.patch('/api/v1/admin/config/feature-flags/:id', { preHandler: superAdminOnly }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { enabled?: boolean };
    await prisma.$executeRawUnsafe(
      `UPDATE governance.system_configs SET value = jsonb_set(COALESCE(value, '{}')::jsonb, '{enabled}', $1::jsonb), updated_at = NOW() WHERE id = $2::uuid`,
      JSON.stringify(body.enabled ?? false),
      id,
    );
    return { data: { id, ...body } };
  });

  // GET /api/v1/admin/config/rate-limits
  app.get('/api/v1/admin/config/rate-limits', { preHandler: superAdminOnly }, async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, key, value, tenant_id, updated_at FROM governance.system_configs WHERE category = 'rate-limits' ORDER BY key`,
      );
      const limits = rows.map(r => {
        const v = typeof r.value === 'object' ? r.value : {};
        return {
          id: r.id,
          tenantId: r.tenant_id ?? '',
          tenantName: r.tenant_id ? `Tenant ${(r.tenant_id as string).slice(0, 8)}` : 'Global',
          endpoint: r.key,
          maxRequests: (v as any)?.maxRequests ?? 100,
          windowSeconds: (v as any)?.windowSeconds ?? 60,
          updatedAt: r.updated_at,
        };
      });
      return { data: limits };
    } catch {
      return { data: [] };
    }
  });

  // POST /api/v1/admin/config/rate-limits
  app.post('/api/v1/admin/config/rate-limits', { preHandler: superAdminOnly }, async (request) => {
    const { tenantId, endpoint, maxRequests, windowSeconds } = request.body as any;
    const value = JSON.stringify({ maxRequests, windowSeconds });
    await prisma.$executeRawUnsafe(
      `INSERT INTO governance.system_configs (id, category, key, value, label, type, is_editable, scope, tenant_id, created_at, updated_at)
       VALUES (gen_random_uuid(), 'rate-limits', $1, $2::jsonb, '{"en":"Rate limit"}'::jsonb, 'json', true, 'global', $3::uuid, NOW(), NOW())`,
      endpoint, value, tenantId || null,
    );
    return { data: { endpoint, maxRequests, windowSeconds } };
  });

  // PATCH /api/v1/admin/config/rate-limits/:id
  app.patch('/api/v1/admin/config/rate-limits/:id', { preHandler: superAdminOnly }, async (request) => {
    const { id } = request.params as { id: string };
    const { maxRequests, windowSeconds } = request.body as any;
    const value = JSON.stringify({ maxRequests, windowSeconds });
    await prisma.$executeRawUnsafe(
      `UPDATE governance.system_configs SET value = $1::jsonb, updated_at = NOW() WHERE id = $2::uuid`,
      value, id,
    );
    return { data: { id, maxRequests, windowSeconds } };
  });

  // GET /api/v1/admin/config/kafka/topics
  app.get('/api/v1/admin/config/kafka/topics', { preHandler: superAdminOnly }, async () => {
    try {
      // Use KafkaJS Admin API to list all topics
      const { Kafka } = await import('kafkajs');
      const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
      const kafka = new Kafka({ clientId: 'aris-topic-lister', brokers, connectionTimeout: 10_000 });
      const admin = kafka.admin();
      await admin.connect();

      const topicMetadata = await admin.fetchTopicMetadata();
      const kafkaHealth = await (app as any).kafkaHealthService.getHealth().catch(() => ({ consumers: [] }));

      // Build consumer group map from health data
      const topicConsumers = new Map<string, Set<string>>();
      for (const consumer of kafkaHealth.consumers ?? []) {
        const offsets = await admin.fetchOffsets({ groupId: consumer.groupId }).catch(() => []);
        for (const o of offsets) {
          if (!topicConsumers.has(o.topic)) topicConsumers.set(o.topic, new Set());
          topicConsumers.get(o.topic)!.add(consumer.groupId);
        }
      }

      const topics = topicMetadata.topics
        .filter(t => !t.name.startsWith('__')) // exclude internal topics
        .map(t => ({
          name: t.name,
          partitions: t.partitions.length,
          replicationFactor: t.partitions[0]?.replicas?.length ?? 1,
          messageCount: 0,
          consumerGroups: [...(topicConsumers.get(t.name) ?? [])],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      await admin.disconnect();
      return { data: topics };
    } catch (err) {
      app.log.warn(err, 'Failed to fetch Kafka topics');
      return { data: [] };
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  MAINTENANCE — Toggle mode + scheduled windows
  // ═══════════════════════════════════════════════════════════════

  // GET /api/v1/admin/maintenance
  app.get('/api/v1/admin/maintenance', { preHandler: superAdminOnly }, async () => {
    let enabled = false;
    let message = '';
    let startedAt: string | null = null;
    let scheduledEnd: string | null = null;
    let scheduledWindows: any[] = [];

    try {
      // Read maintenance state from system_configs
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT key, value FROM governance.system_configs WHERE category = 'maintenance' ORDER BY key`,
      );
      for (const row of rows) {
        if (row.key === 'status') {
          const v = typeof row.value === 'object' ? row.value : {};
          enabled = (v as any)?.enabled === true;
          message = (v as any)?.message ?? '';
          startedAt = (v as any)?.startedAt ?? null;
          scheduledEnd = (v as any)?.scheduledEnd ?? null;
        }
        if (row.key === 'scheduled_windows') {
          scheduledWindows = Array.isArray(row.value) ? row.value : [];
        }
      }
    } catch { /* table may not have maintenance rows yet */ }

    return {
      data: { enabled, message, startedAt, scheduledEnd, scheduledWindows },
    };
  });

  // POST /api/v1/admin/maintenance/toggle
  app.post('/api/v1/admin/maintenance/toggle', { preHandler: superAdminOnly }, async (request) => {
    const { enabled, message, scheduledEnd } = request.body as {
      enabled: boolean; message?: string; scheduledEnd?: string;
    };
    const value = JSON.stringify({
      enabled,
      message: message ?? '',
      startedAt: enabled ? new Date().toISOString() : null,
      scheduledEnd: scheduledEnd ?? null,
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO governance.system_configs (id, category, key, value, label, type, is_editable, scope, created_at, updated_at)
       VALUES (gen_random_uuid(), 'maintenance', 'status', $1::jsonb,
               '{"en":"Maintenance status"}'::jsonb, 'json', true, 'global', NOW(), NOW())
       ON CONFLICT (category, key) WHERE tenant_id IS NULL
       DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      value,
    );
    return { data: { enabled, message } };
  });

  // POST /api/v1/admin/maintenance/schedule
  app.post('/api/v1/admin/maintenance/schedule', { preHandler: superAdminOnly }, async (request) => {
    const { reason, startAt, endAt } = request.body as { reason: string; startAt: string; endAt: string };
    const newWindow = {
      id: crypto.randomUUID(),
      reason,
      startAt,
      endAt,
      createdBy: (request as any).user?.email ?? 'admin',
      createdAt: new Date().toISOString(),
    };

    // Read existing windows
    let windows: any[] = [];
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT value FROM governance.system_configs WHERE category = 'maintenance' AND key = 'scheduled_windows'`,
      );
      if (rows[0]) windows = Array.isArray(rows[0].value) ? rows[0].value : [];
    } catch { /* */ }

    windows.push(newWindow);
    const value = JSON.stringify(windows);
    await prisma.$executeRawUnsafe(
      `INSERT INTO governance.system_configs (id, category, key, value, label, type, is_editable, scope, created_at, updated_at)
       VALUES (gen_random_uuid(), 'maintenance', 'scheduled_windows', $1::jsonb,
               '{"en":"Scheduled maintenance windows"}'::jsonb, 'json', true, 'global', NOW(), NOW())
       ON CONFLICT (category, key) WHERE tenant_id IS NULL
       DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      value,
    );
    return { data: newWindow };
  });

  // DELETE /api/v1/admin/maintenance/schedule/:id
  app.delete('/api/v1/admin/maintenance/schedule/:id', { preHandler: superAdminOnly }, async (request) => {
    const { id } = request.params as { id: string };
    let windows: any[] = [];
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT value FROM governance.system_configs WHERE category = 'maintenance' AND key = 'scheduled_windows'`,
      );
      if (rows[0]) windows = Array.isArray(rows[0].value) ? rows[0].value : [];
    } catch { /* */ }

    windows = windows.filter((w: any) => w.id !== id);
    await prisma.$executeRawUnsafe(
      `UPDATE governance.system_configs SET value = $1::jsonb, updated_at = NOW() WHERE category = 'maintenance' AND key = 'scheduled_windows'`,
      JSON.stringify(windows),
    );
    return { data: { success: true } };
  });

}
