'use client';

import { useMemo } from 'react';
import {
  Activity,
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  Radio,
  Clock,
  Cpu,
  Zap,
} from 'lucide-react';
import {
  useInfraHealth,
  useServiceHealth,
  useSystemMetrics,
} from '@/lib/api/hooks';
import type {
  DetailedServiceHealth,
  KafkaConsumerLag,
  PostgresPoolStats,
  RedisStats,
} from '@/lib/api/hooks';

// ── Complete 22-service registry ──

const SERVICE_REGISTRY = [
  { name: 'tenant-service', port: 3001, group: 'Platform' },
  { name: 'credential-service', port: 3002, group: 'Platform' },
  { name: 'message-service', port: 3006, group: 'Platform' },
  { name: 'drive-service', port: 3007, group: 'Platform' },
  { name: 'realtime-service', port: 3008, group: 'Platform' },
  { name: 'master-data-service', port: 3003, group: 'Data Hub' },
  { name: 'data-quality-service', port: 3004, group: 'Data Hub' },
  { name: 'data-contract-service', port: 3005, group: 'Data Hub' },
  { name: 'interop-hub', port: 3032, group: 'Data Hub' },
  { name: 'form-builder-service', port: 3010, group: 'Collecte & Workflow' },
  { name: 'collecte-service', port: 3011, group: 'Collecte & Workflow' },
  { name: 'workflow-service', port: 3012, group: 'Collecte & Workflow' },
  { name: 'animal-health-service', port: 3020, group: 'Domain Services' },
  { name: 'livestock-prod-service', port: 3021, group: 'Domain Services' },
  { name: 'fisheries-service', port: 3022, group: 'Domain Services' },
  { name: 'wildlife-service', port: 3023, group: 'Domain Services' },
  { name: 'apiculture-service', port: 3024, group: 'Domain Services' },
  { name: 'trade-sps-service', port: 3025, group: 'Domain Services' },
  { name: 'governance-service', port: 3026, group: 'Domain Services' },
  { name: 'climate-env-service', port: 3027, group: 'Domain Services' },
  { name: 'analytics-service', port: 3030, group: 'Data & Integration' },
  { name: 'geo-services', port: 3031, group: 'Data & Integration' },
];

const GROUP_ORDER = [
  'Platform',
  'Data Hub',
  'Collecte & Workflow',
  'Domain Services',
  'Data & Integration',
];

// ── Helpers ──

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMemoryMB(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseMemoryString(mem: string): number {
  if (!mem) return 0;
  const num = parseFloat(mem);
  if (isNaN(num)) return 0;
  const lower = mem.toLowerCase();
  if (lower.includes('gb')) return num * 1024 * 1024 * 1024;
  if (lower.includes('mb')) return num * 1024 * 1024;
  if (lower.includes('kb')) return num * 1024;
  return num;
}

function lagStatusColor(lag: number): string {
  if (lag < 100) return 'text-status-healthy';
  if (lag < 1000) return 'text-status-degraded';
  return 'text-status-down';
}

function lagBgColor(lag: number): string {
  if (lag < 100) return 'bg-status-healthy';
  if (lag < 1000) return 'bg-status-degraded';
  return 'bg-status-down';
}

// ── Components ──

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; pulse: boolean }> = {
    healthy: { color: 'bg-status-healthy', pulse: false },
    degraded: { color: 'bg-status-degraded', pulse: true },
    down: { color: 'bg-status-down', pulse: true },
    unknown: { color: 'bg-status-unknown', pulse: false },
  };
  const { color, pulse } = config[status] ?? config['unknown'];
  return (
    <div className="relative">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {pulse && (
        <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${color} animate-ping opacity-50`} />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-card p-4">
            <div className="h-4 bg-admin-surface rounded animate-pulse mb-2 w-2/3" />
            <div className="h-8 bg-admin-surface rounded animate-pulse w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-card p-6">
            <div className="h-4 bg-admin-surface rounded animate-pulse mb-4 w-1/2" />
            <div className="h-20 bg-admin-surface rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 bg-admin-surface rounded animate-pulse mb-3 w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="admin-card p-4">
                  <div className="h-4 bg-admin-surface rounded animate-pulse mb-2" />
                  <div className="h-4 bg-admin-surface rounded animate-pulse w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostgresCard({ stats }: { stats: PostgresPoolStats | undefined }) {
  const active = stats?.activeConnections ?? 0;
  const max = stats?.maxConnections ?? 1;
  const pct = max > 0 ? Math.round((active / max) * 100) : 0;
  const barColor = pct < 60 ? 'bg-status-healthy' : pct < 85 ? 'bg-status-degraded' : 'bg-status-down';

  return (
    <div className="admin-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary-900/30">
          <Database className="w-5 h-5 text-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-admin-heading">PostgreSQL</h2>
      </div>

      {/* Connection pool bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-admin-muted">Connection Pool</p>
          <p className="text-xs font-mono text-admin-muted">{active} / {max} ({pct}%)</p>
        </div>
        <div className="w-full h-2.5 bg-admin-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-kpi-sm text-admin-heading">{stats?.activeConnections ?? 0}</p>
          <p className="text-xs text-admin-muted">Active</p>
        </div>
        <div>
          <p className="text-kpi-sm text-admin-heading">{stats?.idleConnections ?? 0}</p>
          <p className="text-xs text-admin-muted">Idle</p>
        </div>
        <div>
          <p className="text-kpi-sm text-admin-heading">{stats?.waitingRequests ?? 0}</p>
          <p className="text-xs text-admin-muted">Waiting</p>
        </div>
      </div>
    </div>
  );
}

function RedisCard({ stats }: { stats: RedisStats | undefined }) {
  const usedBytes = parseMemoryString(stats?.usedMemory ?? '0');
  const peakBytes = parseMemoryString(stats?.usedMemoryPeak ?? '0');
  const memPct = peakBytes > 0 ? Math.round((usedBytes / peakBytes) * 100) : 0;

  return (
    <div className="admin-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary-900/30">
          <Zap className="w-5 h-5 text-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-admin-heading">Redis</h2>
      </div>

      {/* Memory bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-admin-muted">Memory Usage</p>
          <p className="text-xs font-mono text-admin-muted">
            {stats?.usedMemory ?? '—'} / {stats?.usedMemoryPeak ?? '—'} ({memPct}%)
          </p>
        </div>
        <div className="w-full h-2.5 bg-admin-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              memPct < 70 ? 'bg-status-healthy' : memPct < 90 ? 'bg-status-degraded' : 'bg-status-down'
            }`}
            style={{ width: `${Math.min(memPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-kpi-sm text-admin-heading">{stats?.connectedClients ?? 0}</p>
          <p className="text-xs text-admin-muted">Clients</p>
        </div>
        <div>
          <p className="text-kpi-sm text-admin-heading">{(stats?.totalKeys ?? 0).toLocaleString()}</p>
          <p className="text-xs text-admin-muted">Total Keys</p>
        </div>
        <div>
          <p className="text-kpi-sm text-admin-heading">{(stats?.hitRate ?? 0).toFixed(1)}%</p>
          <p className="text-xs text-admin-muted">Hit Rate</p>
        </div>
      </div>
    </div>
  );
}

function KafkaLagCard({ consumerGroups }: { consumerGroups: KafkaConsumerLag[] | undefined }) {
  const groups = consumerGroups ?? [];
  const totalLag = groups.reduce((sum, g) => sum + g.totalLag, 0);

  return (
    <div className="admin-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary-900/30">
          <Radio className="w-5 h-5 text-primary-400" />
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-admin-heading">Kafka Consumer Lag</h2>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
            totalLag < 100 ? 'bg-status-healthy/10 text-status-healthy'
              : totalLag < 1000 ? 'bg-status-degraded/10 text-status-degraded'
              : 'bg-status-down/10 text-status-down'
          }`}>
            {totalLag.toLocaleString()} total
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-admin-muted">No consumer groups found</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {groups.map((g) => (
            <div
              key={`${g.groupId}-${g.topic}`}
              className="flex items-center justify-between py-1.5 border-b border-admin-border/50 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${lagBgColor(g.totalLag)}`} />
                <p className="text-xs font-mono text-admin-muted truncate">{g.groupId}</p>
              </div>
              <p className={`text-xs font-mono flex-shrink-0 ml-2 ${lagStatusColor(g.totalLag)}`}>
                {g.totalLag.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: DetailedServiceHealth }) {
  return (
    <div className="admin-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <StatusDot status={service.status} />
          <div>
            <p className="text-sm font-medium text-admin-heading">{service.name}</p>
            <p className="text-xs text-admin-muted">:{service.port}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          service.status === 'healthy'
            ? 'bg-status-healthy/10 text-status-healthy'
            : service.status === 'degraded'
            ? 'bg-status-degraded/10 text-status-degraded'
            : 'bg-status-down/10 text-status-down'
        }`}>
          {service.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-admin-muted flex-shrink-0" />
          <p className="text-xs font-mono text-admin-muted">{service.responseTime}ms</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-admin-muted flex-shrink-0" />
          <p className="text-xs font-mono text-admin-muted">{service.version || '—'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Server className="w-3 h-3 text-admin-muted flex-shrink-0" />
          <p className="text-xs font-mono text-admin-muted">{formatUptime(service.uptime)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-admin-muted flex-shrink-0" />
          <p className="text-xs font-mono text-admin-muted">{formatMemoryMB(service.memoryUsage)}</p>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-admin-border/50">
        <p className="text-xs text-admin-muted">
          Last check: {service.lastCheck ? new Date(service.lastCheck).toLocaleTimeString() : '—'}
        </p>
      </div>
    </div>
  );
}

function ServiceCardSkeleton() {
  return (
    <div className="admin-card p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-2.5 h-2.5 bg-admin-surface rounded-full animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-admin-surface rounded animate-pulse w-3/4 mb-1" />
          <div className="h-3 bg-admin-surface rounded animate-pulse w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 bg-admin-surface rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function MonitoringPage() {
  const { data: infraHealth, isLoading: infraLoading, refetch: refetchInfra } = useInfraHealth();
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useServiceHealth();
  useSystemMetrics();

  const isLoading = infraLoading || servicesLoading;

  const handleRefresh = () => {
    refetchInfra();
    refetchServices();
  };

  // Build a map from infra health services for detailed info
  const detailedServiceMap = useMemo(() => {
    const map = new Map<string, DetailedServiceHealth>();
    (infraHealth?.services ?? []).forEach((s) => map.set(s.name, s));
    return map;
  }, [infraHealth?.services]);

  // Fallback to basic service health if infra not available
  const basicServiceMap = useMemo(() => {
    const map = new Map<string, { status: string; responseTime: number; lastCheck: string; version: string }>();
    (services ?? []).forEach((s) => map.set(s.name, s));
    return map;
  }, [services]);

  // Compute KPI counts
  const counts = useMemo(() => {
    let healthy = 0;
    let degraded = 0;
    let down = 0;

    for (const reg of SERVICE_REGISTRY) {
      const detailed = detailedServiceMap.get(reg.name);
      const basic = basicServiceMap.get(reg.name);
      const status = detailed?.status ?? basic?.status ?? 'unknown';
      if (status === 'healthy') healthy++;
      else if (status === 'degraded') degraded++;
      else if (status === 'down') down++;
    }

    return { healthy, degraded, down };
  }, [detailedServiceMap, basicServiceMap]);

  // Group services for the grid
  const groupedServices = useMemo(() => {
    const groups: Record<string, typeof SERVICE_REGISTRY> = {};
    for (const svc of SERVICE_REGISTRY) {
      if (!groups[svc.group]) groups[svc.group] = [];
      groups[svc.group].push(svc);
    }
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-admin-heading">
            System Health Dashboard
          </h1>
          <p className="text-sm text-admin-muted mt-1">
            Real-time infrastructure and service monitoring for all 22 ARIS microservices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-admin-muted flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-status-healthy animate-pulse" />
            Auto-refresh: 15s
          </span>
          <button
            onClick={handleRefresh}
            className="admin-btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading && !infraHealth && !services ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* ── Summary KPI Row ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="admin-card p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary-900/30">
                <Server className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-kpi-sm text-admin-heading">{SERVICE_REGISTRY.length}</p>
                <p className="text-xs text-admin-muted">Total Services</p>
              </div>
            </div>

            <div className="admin-card p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-status-healthy/10">
                <CheckCircle className="w-5 h-5 text-status-healthy" />
              </div>
              <div>
                <p className="text-kpi-sm text-admin-heading">{counts.healthy}</p>
                <p className="text-xs text-admin-muted">Healthy</p>
              </div>
            </div>

            <div className="admin-card p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-status-degraded/10">
                <AlertTriangle className="w-5 h-5 text-status-degraded" />
              </div>
              <div>
                <p className="text-kpi-sm text-admin-heading">{counts.degraded}</p>
                <p className="text-xs text-admin-muted">Degraded</p>
              </div>
            </div>

            <div className="admin-card p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-status-down/10">
                <XCircle className="w-5 h-5 text-status-down" />
              </div>
              <div>
                <p className="text-kpi-sm text-admin-heading">{counts.down}</p>
                <p className="text-xs text-admin-muted">Down</p>
              </div>
            </div>
          </div>

          {/* ── Infrastructure Metrics Row ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PostgresCard stats={infraHealth?.postgres} />
            <RedisCard stats={infraHealth?.redis} />
            <KafkaLagCard consumerGroups={infraHealth?.kafka?.consumerGroups} />
          </div>

          {/* ── Service Grid Grouped by Category ── */}
          {GROUP_ORDER.map((group) => {
            const groupServices = groupedServices[group];
            if (!groupServices || groupServices.length === 0) return null;

            return (
              <div key={group}>
                <h2 className="text-sm font-semibold text-admin-muted uppercase tracking-wider mb-3">
                  {group}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {groupServices.map((svc) => {
                    const detailed = detailedServiceMap.get(svc.name);
                    const basic = basicServiceMap.get(svc.name);

                    if (detailed) {
                      return <ServiceCard key={svc.name} service={detailed} />;
                    }

                    if (basic) {
                      // Render with available basic data
                      return (
                        <ServiceCard
                          key={svc.name}
                          service={{
                            name: svc.name,
                            port: svc.port,
                            status: basic.status as 'healthy' | 'degraded' | 'down',
                            responseTime: basic.responseTime,
                            lastCheck: basic.lastCheck,
                            version: basic.version,
                            uptime: 0,
                            memoryUsage: 0,
                          }}
                        />
                      );
                    }

                    // No data yet — show skeleton-like card
                    if (isLoading) {
                      return <ServiceCardSkeleton key={svc.name} />;
                    }

                    // No data and not loading — show unknown state
                    return (
                      <ServiceCard
                        key={svc.name}
                        service={{
                          name: svc.name,
                          port: svc.port,
                          status: 'down',
                          responseTime: 0,
                          lastCheck: '',
                          version: '',
                          uptime: 0,
                          memoryUsage: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
