'use client';

import {
  Users,
  Building2,
  FileText,
  Activity,
  Database,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { useDashboardStats, useServiceHealth } from '@/lib/api/hooks';

export default function AdminDashboardPage() {
  const { data: stats } = useDashboardStats();
  const { data: services } = useServiceHealth();

  const healthyCount = services?.filter((s) => s.status === 'healthy').length ?? 0;
  const totalCount = services?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-heading">
          System Dashboard
        </h1>
        <p className="text-sm text-admin-muted mt-1">
          Overview of the ARIS 3.0 continental infrastructure
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          sub={`${stats?.activeUsers30d ?? 0} active (30d)`}
          color="primary"
        />
        <KpiCard
          icon={<Building2 className="w-5 h-5" />}
          label="Tenants"
          value={stats?.totalTenants ?? 0}
          sub={`${stats?.activeTenants ?? 0} active`}
          color="secondary"
        />
        <KpiCard
          icon={<FileText className="w-5 h-5" />}
          label="Data Contracts"
          value={stats?.totalDataContracts ?? 0}
          sub={`${stats?.avgComplianceRate ?? 0}% compliance`}
          color="accent"
        />
        <KpiCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Quality Pass Rate"
          value={`${stats?.qualityPassRate ?? 0}%`}
          sub={`${stats?.pendingValidations ?? 0} pending`}
          color="primary"
        />
      </div>

      {/* Services & Submissions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Health */}
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-admin-heading">
              Service Health
            </h2>
            <span className="text-xs text-admin-muted">
              {healthyCount}/{totalCount} healthy
            </span>
          </div>

          <div className="space-y-2">
            {services && services.length > 0 ? (
              services.slice(0, 8).map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-admin-surface"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        svc.status === 'healthy'
                          ? 'bg-status-healthy'
                          : svc.status === 'degraded'
                            ? 'bg-status-degraded'
                            : 'bg-status-down'
                      }`}
                    />
                    <span className="text-sm text-admin-text">{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-admin-muted">
                      {svc.responseTime}ms
                    </span>
                    <span className="text-xs text-admin-muted">
                      :{svc.port}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <PlaceholderServices />
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold text-admin-heading mb-4">
            System Activity
          </h2>

          <div className="space-y-4">
            <StatRow
              icon={<Database className="w-4 h-4" />}
              label="Total Submissions"
              value={stats?.totalSubmissions ?? 0}
            />
            <StatRow
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Pending Validations"
              value={stats?.pendingValidations ?? 0}
              highlight={
                (stats?.pendingValidations ?? 0) > 100 ? 'warning' : undefined
              }
            />
            <StatRow
              icon={<Activity className="w-4 h-4" />}
              label="Active Data Contracts"
              value={stats?.activeContracts ?? 0}
            />
            <StatRow
              icon={<TrendingUp className="w-4 h-4" />}
              label="Avg Compliance Rate"
              value={`${stats?.avgComplianceRate ?? 0}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  color: 'primary' | 'secondary' | 'accent';
}) {
  const colorMap = {
    primary: 'text-primary-400 bg-primary-900/30',
    secondary: 'text-secondary-200 bg-secondary-900/30',
    accent: 'text-accent-200 bg-accent-900/30',
  };

  return (
    <div className="admin-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <span className="text-sm text-admin-muted">{label}</span>
      </div>
      <p className="text-kpi text-admin-heading">{value}</p>
      <p className="text-xs text-admin-muted mt-1">{sub}</p>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: 'warning';
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 text-admin-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span
        className={`text-sm font-semibold ${
          highlight === 'warning' ? 'text-status-degraded' : 'text-admin-text'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PlaceholderServices() {
  const placeholders = [
    { name: 'tenant-service', port: 3001 },
    { name: 'credential-service', port: 3002 },
    { name: 'master-data-service', port: 3003 },
    { name: 'data-quality-service', port: 3004 },
    { name: 'data-contract-service', port: 3005 },
    { name: 'collecte-service', port: 3011 },
    { name: 'workflow-service', port: 3012 },
    { name: 'analytics-service', port: 3030 },
  ];

  return (
    <>
      {placeholders.map((svc) => (
        <div
          key={svc.name}
          className="flex items-center justify-between py-2 px-3 rounded-lg bg-admin-surface"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-status-unknown" />
            <span className="text-sm text-admin-muted">{svc.name}</span>
          </div>
          <span className="text-xs text-admin-muted">:{svc.port}</span>
        </div>
      ))}
    </>
  );
}
