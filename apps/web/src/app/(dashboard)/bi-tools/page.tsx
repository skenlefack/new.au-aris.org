'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, PieChart, BarChart2, ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

const BI_TOOLS = [
  {
    id: 'superset',
    name: 'Apache Superset',
    description: 'Advanced analytics and data exploration platform. Create custom dashboards, run SQL queries, and build visualizations from ARIS data.',
    icon: BarChart3,
    color: '#1FC2A7',
    href: '/bi-tools/superset',
    status: 'active' as const,
    features: ['SQL Lab', 'Custom Dashboards', 'Chart Builder', 'Data Exploration'],
    authMethod: 'Guest Token + RLS',
  },
  {
    id: 'metabase',
    name: 'Metabase',
    description: 'Simple and intuitive business intelligence tool. Ask questions about your data and get instant visualizations without writing SQL.',
    icon: PieChart,
    color: '#509EE3',
    href: '/bi-tools/metabase',
    status: 'active' as const,
    features: ['Question Builder', 'Auto Dashboards', 'Alerts', 'Collections'],
    authMethod: 'Session Proxy',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Powerful observability and BI platform. Build dashboards with PostgreSQL queries, template variables, drill-down, and alerting.',
    icon: BarChart2,
    color: '#FF6600',
    href: '/bi-tools/grafana',
    status: 'active' as const,
    features: ['Dashboard Builder', 'PostgreSQL Queries', 'Variables & Drill-down', 'Alerting'],
    authMethod: 'Auth Proxy',
  },
];

export default function BiToolsPage() {
  const user = useAuthStore((s) => s.user);

  const accessLabel = user?.tenantLevel === 'CONTINENTAL'
    ? 'All AU Member States'
    : user?.tenantLevel === 'REC'
      ? 'Regional countries'
      : 'Country data';

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">BI Tools</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Integrated business intelligence and analytics platforms connected to ARIS data
          </p>
        </div>

        {/* Access level indicator */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Data Access Level</p>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{accessLabel}</p>
          </div>
        </div>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {BI_TOOLS.map((tool) => {
          const Icon = tool.icon;

          return (
            <div
              key={tool.id}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 hover:shadow-lg transition-shadow"
            >
              {/* Color accent bar */}
              <div className="h-1.5" style={{ backgroundColor: tool.color }} />

              <div className="p-6">
                {/* Icon + Name */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${tool.color}15` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: tool.color }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{tool.name}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Auto-connected
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {tool.description}
                </p>

                {/* Features */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      className="rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-6">
                  <Link
                    href={tool.href}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: tool.color }}
                  >
                    Open in ARIS
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How it works</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          All BI tools are automatically authenticated with your ARIS account. Data is filtered based on your access level.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoCard
            label="Authentication"
            value="Automatic SSO"
            detail="No separate login needed"
          />
          <InfoCard
            label="Data Filtering"
            value="Tenant-scoped"
            detail="Only your authorized data"
          />
          <InfoCard
            label="Database Access"
            value="Read-only"
            detail="Sensitive tables excluded"
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{detail}</p>
    </div>
  );
}
