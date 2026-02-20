'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSystemMetrics } from '@/lib/api/hooks';
import {
  LogOut,
  Server,
  Users,
  Building2,
  Activity,
  Shield,
} from 'lucide-react';

export function AdminHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: metrics } = useSystemMetrics();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 border-b border-admin-border bg-admin-surface flex items-center justify-between px-6">
      {/* System metrics */}
      <div className="flex items-center gap-6">
        <MetricChip
          icon={<Users className="w-3.5 h-3.5" />}
          label="Users"
          value={metrics?.totalUsers ?? '—'}
        />
        <MetricChip
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Tenants"
          value={metrics?.totalTenants ?? '—'}
        />
        <MetricChip
          icon={<Server className="w-3.5 h-3.5" />}
          label="Services"
          value={metrics?.healthyServices ?? '—'}
          suffix={metrics ? `/${metrics.totalServices}` : ''}
          status={
            metrics
              ? metrics.healthyServices === metrics.totalServices
                ? 'healthy'
                : 'degraded'
              : undefined
          }
        />
        <MetricChip
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Kafka Lag"
          value={metrics?.kafkaLag ?? '—'}
          status={
            metrics
              ? (metrics.kafkaLag as number) > 1000
                ? 'degraded'
                : 'healthy'
              : undefined
          }
        />
      </div>

      {/* User info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-900/50 border border-primary-800 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-400" />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-admin-text">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-admin-muted">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-admin-muted hover:text-danger-500 hover:bg-admin-hover transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function MetricChip({
  icon,
  label,
  value,
  suffix,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  status?: 'healthy' | 'degraded' | 'down';
}) {
  const statusColor = status
    ? { healthy: 'text-status-healthy', degraded: 'text-status-degraded', down: 'text-status-down' }[status]
    : 'text-admin-text';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-admin-muted">{icon}</span>
      <span className="text-admin-muted">{label}</span>
      <span className={`font-mono font-semibold ${statusColor}`}>
        {value}
        {suffix}
      </span>
    </div>
  );
}
