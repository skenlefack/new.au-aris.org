'use client';

import {
  Activity,
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useServiceHealth, useSystemMetrics } from '@/lib/api/hooks';

const SERVICE_REGISTRY = [
  { name: 'tenant-service', port: 3001, group: 'Platform' },
  { name: 'credential-service', port: 3002, group: 'Platform' },
  { name: 'master-data-service', port: 3003, group: 'Data Hub' },
  { name: 'data-quality-service', port: 3004, group: 'Data Hub' },
  { name: 'data-contract-service', port: 3005, group: 'Data Hub' },
  { name: 'message-service', port: 3006, group: 'Platform' },
  { name: 'drive-service', port: 3007, group: 'Platform' },
  { name: 'realtime-service', port: 3008, group: 'Platform' },
  { name: 'form-builder-service', port: 3010, group: 'Collecte & Workflow' },
  { name: 'collecte-service', port: 3011, group: 'Collecte & Workflow' },
  { name: 'workflow-service', port: 3012, group: 'Collecte & Workflow' },
  { name: 'animal-health-service', port: 3020, group: 'Domain' },
  { name: 'analytics-service', port: 3030, group: 'Data & Integration' },
  { name: 'geo-services', port: 3031, group: 'Data & Integration' },
  { name: 'interop-hub', port: 3032, group: 'Data & Integration' },
];

export default function MonitoringPage() {
  const { data: services, isLoading, refetch } = useServiceHealth();
  const { data: metrics } = useSystemMetrics();

  const serviceMap = new Map(
    (services ?? []).map((s) => [s.name, s]),
  );

  const groups = [...new Set(SERVICE_REGISTRY.map((s) => s.group))];

  const healthyCount = services?.filter((s) => s.status === 'healthy').length ?? 0;
  const degradedCount = services?.filter((s) => s.status === 'degraded').length ?? 0;
  const downCount = services?.filter((s) => s.status === 'down').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-admin-heading">
            Service Monitoring
          </h1>
          <p className="text-sm text-admin-muted mt-1">
            Real-time health checks for all ARIS microservices
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="admin-btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Health Summary */}
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
            <p className="text-kpi-sm text-admin-heading">{healthyCount}</p>
            <p className="text-xs text-admin-muted">Healthy</p>
          </div>
        </div>
        <div className="admin-card p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-status-degraded/10">
            <AlertTriangle className="w-5 h-5 text-status-degraded" />
          </div>
          <div>
            <p className="text-kpi-sm text-admin-heading">{degradedCount}</p>
            <p className="text-xs text-admin-muted">Degraded</p>
          </div>
        </div>
        <div className="admin-card p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-status-down/10">
            <Activity className="w-5 h-5 text-status-down" />
          </div>
          <div>
            <p className="text-kpi-sm text-admin-heading">{metrics?.kafkaLag ?? 0}</p>
            <p className="text-xs text-admin-muted">Kafka Lag</p>
          </div>
        </div>
      </div>

      {/* Service Grid by Group */}
      {groups.map((group) => {
        const groupServices = SERVICE_REGISTRY.filter((s) => s.group === group);
        return (
          <div key={group}>
            <h2 className="text-sm font-semibold text-admin-muted uppercase tracking-wider mb-3">
              {group}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groupServices.map((svc) => {
                const live = serviceMap.get(svc.name);
                const status = live?.status ?? 'unknown';
                return (
                  <div
                    key={svc.name}
                    className="admin-card p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <StatusDot status={status} />
                      <div>
                        <p className="text-sm font-medium text-admin-text">
                          {svc.name}
                        </p>
                        <p className="text-xs text-admin-muted">
                          :{svc.port}
                          {live?.version && ` — v${live.version}`}
                        </p>
                      </div>
                    </div>
                    {live && (
                      <div className="text-right">
                        <p className="text-xs font-mono text-admin-muted">
                          {live.responseTime}ms
                        </p>
                        <p className="text-xs text-admin-muted">
                          {new Date(live.lastCheck).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Kafka UI Embed */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-admin-heading">
            Kafka Dashboard
          </h2>
          <a
            href={process.env['NEXT_PUBLIC_KAFKA_UI_URL'] ?? 'http://localhost:8080'}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn-secondary flex items-center gap-2 text-xs"
          >
            Open Kafka UI
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="bg-admin-surface rounded-lg border border-admin-border overflow-hidden">
          <iframe
            src={process.env['NEXT_PUBLIC_KAFKA_UI_URL'] ?? 'http://localhost:8080'}
            className="w-full h-[500px] border-0"
            title="Kafka UI"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}

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
