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
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { SettingsBackButton } from '@/components/settings/SettingsBackButton';
import { SuperAdminGuard } from '@/components/settings/SuperAdminGuard';

// ── Types ──

interface DetailedServiceHealth {
  name: string;
  port: number;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
  version: string;
  uptime: number;
  memoryUsage: number;
}

interface KafkaConsumerLag {
  groupId: string;
  topic: string;
  totalLag: number;
  partitions: Array<{ partition: number; currentOffset: number; endOffset: number; lag: number }>;
}

interface PostgresPoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
  maxConnections: number;
}

interface RedisStats {
  usedMemory: string;
  usedMemoryPeak: string;
  connectedClients: number;
  totalKeys: number;
  hitRate: number;
  uptimeSeconds: number;
}

interface InfraHealth {
  services: DetailedServiceHealth[];
  kafka: { consumerGroups: KafkaConsumerLag[] };
  postgres: PostgresPoolStats;
  redis: RedisStats;
}

interface ServiceHealth {
  name: string;
  status: string;
  responseTime: number;
  lastCheck: string;
  version: string;
}

interface SystemMetrics {
  totalUsers: number;
  totalTenants: number;
  healthyServices: number;
  totalServices: number;
  kafkaLag: number;
}

// ── Inline Hooks ──

function useInfraHealth() {
  return useQuery<InfraHealth>({
    queryKey: ['settings', 'infra-health'],
    queryFn: () => apiClient.get('/admin/infra/health'),
    refetchInterval: 15_000,
  });
}

function useServiceHealth() {
  return useQuery<ServiceHealth[]>({
    queryKey: ['settings', 'service-health'],
    queryFn: () => apiClient.get('/admin/services/health'),
    refetchInterval: 15_000,
  });
}

function useSystemMetrics() {
  return useQuery<SystemMetrics>({
    queryKey: ['settings', 'system-metrics'],
    queryFn: () => apiClient.get('/admin/system/metrics'),
    refetchInterval: 30_000,
    placeholderData: {
      totalUsers: 0,
      totalTenants: 0,
      healthyServices: 0,
      totalServices: 15,
      kafkaLag: 0,
    },
  });
}

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
  if (!seconds || seconds <= 0) return '\u2014';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMemoryMB(bytes: number): string {
  if (!bytes || bytes <= 0) return '\u2014';
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
  if (lag < 100) return 'text-green-600 dark:text-green-400';
  if (lag < 1000) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function lagBgColor(lag: number): string {
  if (lag < 100) return 'bg-green-500';
  if (lag < 1000) return 'bg-amber-500';
  return 'bg-red-500';
}

// ── Components ──

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; pulse: boolean }> = {
    healthy: { color: 'bg-green-500', pulse: false },
    degraded: { color: 'bg-amber-500', pulse: true },
    down: { color: 'bg-red-500', pulse: true },
    unknown: { color: 'bg-gray-400', pulse: false },
  };
  const { color, pulse } = config[status] ?? config['unknown'];
  return (
    <div className="relative">
      <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
      {pulse && (
        <div className={cn('absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-50', color)} />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2 w-2/3" />
            <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-4 w-1/2" />
            <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-3 w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-2/3" />
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
  const barColor = pct < 60 ? 'bg-green-500' : pct < 85 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
          <Database className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">PostgreSQL</h2>
      </div>

      {/* Connection pool bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Connection Pool</p>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{active} / {max} ({pct}%)</p>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.activeConnections ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.idleConnections ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Idle</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.waitingRequests ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Waiting</p>
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
          <Zap className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Redis</h2>
      </div>

      {/* Memory bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Memory Usage</p>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
            {stats?.usedMemory ?? '\u2014'} / {stats?.usedMemoryPeak ?? '\u2014'} ({memPct}%)
          </p>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              memPct < 70 ? 'bg-green-500' : memPct < 90 ? 'bg-amber-500' : 'bg-red-500',
            )}
            style={{ width: `${Math.min(memPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.connectedClients ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Clients</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats?.totalKeys ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Keys</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats?.hitRate ?? 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Hit Rate</p>
        </div>
      </div>
    </div>
  );
}

function KafkaLagCard({ consumerGroups }: { consumerGroups: KafkaConsumerLag[] | undefined }) {
  const groups = consumerGroups ?? [];
  const totalLag = groups.reduce((sum, g) => sum + g.totalLag, 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
          <Radio className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kafka Consumer Lag</h2>
          <span className={cn(
            'text-xs font-mono px-2 py-0.5 rounded-full',
            totalLag < 100 ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : totalLag < 1000 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400',
          )}>
            {totalLag.toLocaleString()} total
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">No consumer groups found</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {groups.map((g) => (
            <div
              key={`${g.groupId}-${g.topic}`}
              className="flex items-center justify-between py-1.5 border-b border-gray-200/50 dark:border-gray-700/50 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', lagBgColor(g.totalLag))} />
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{g.groupId}</p>
              </div>
              <p className={cn('text-xs font-mono flex-shrink-0 ml-2', lagStatusColor(g.totalLag))}>
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <StatusDot status={service.status} />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{service.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">:{service.port}</p>
          </div>
        </div>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          service.status === 'healthy'
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : service.status === 'degraded'
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'bg-red-500/10 text-red-600 dark:text-red-400',
        )}>
          {service.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{service.responseTime}ms</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{service.version || '\u2014'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Server className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{formatUptime(service.uptime)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{formatMemoryMB(service.memoryUsage)}</p>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last check: {service.lastCheck ? new Date(service.lastCheck).toLocaleTimeString() : '\u2014'}
        </p>
      </div>
    </div>
  );
}

function ServiceCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-2.5 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/4 mb-1" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
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
    <SuperAdminGuard>
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Health Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time infrastructure and service monitoring for all 22 ARIS microservices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SettingsBackButton />
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-refresh: 15s
          </span>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
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
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-aris-primary-50 dark:bg-aris-primary-900/30">
                <Server className="w-5 h-5 text-aris-primary-600 dark:text-aris-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{SERVICE_REGISTRY.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Services</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.healthy}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Healthy</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.degraded}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Degraded</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.down}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Down</p>
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
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
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

                    // No data yet -- show skeleton-like card
                    if (isLoading) {
                      return <ServiceCardSkeleton key={svc.name} />;
                    }

                    // No data and not loading -- show unknown state
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
    </SuperAdminGuard>
  );
}
