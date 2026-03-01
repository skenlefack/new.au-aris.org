'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, PieChart, BarChart2, ExternalLink, ArrowRight } from 'lucide-react';

const BI_TOOLS = [
  {
    id: 'superset',
    name: 'Apache Superset',
    description: 'Advanced analytics and data exploration platform. Create custom dashboards, run SQL queries, and build visualizations from ARIS data.',
    icon: BarChart3,
    color: '#1FC2A7',
    href: '/bi-tools/superset',
    externalUrl: 'http://localhost:8088',
    status: 'active' as const,
    features: ['SQL Lab', 'Custom Dashboards', 'Chart Builder', 'Data Exploration'],
  },
  {
    id: 'metabase',
    name: 'Metabase',
    description: 'Simple and intuitive business intelligence tool. Ask questions about your data and get instant visualizations without writing SQL.',
    icon: PieChart,
    color: '#509EE3',
    href: '/bi-tools/metabase',
    externalUrl: 'http://localhost:3035',
    status: 'active' as const,
    features: ['Question Builder', 'Auto Dashboards', 'Alerts', 'Collections'],
  },
  {
    id: 'powerbi',
    name: 'Power BI',
    description: 'Microsoft Power BI integration for enterprise reporting. Connect your existing Power BI reports to ARIS data sources.',
    icon: BarChart2,
    color: '#F2C811',
    href: '#',
    externalUrl: '',
    status: 'coming_soon' as const,
    features: ['Report Embedding', 'DirectQuery', 'Dataflows', 'AI Insights'],
  },
];

export default function BiToolsPage() {
  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">BI Tools</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Integrated business intelligence and analytics platforms connected to ARIS data
        </p>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {BI_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.status === 'active';

          return (
            <div
              key={tool.id}
              className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${
                isActive
                  ? 'border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow'
                  : 'border-slate-100 dark:border-slate-800 opacity-60'
              }`}
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
                      {!isActive && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          Coming Soon
                        </span>
                      )}
                      {isActive && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                          Active
                        </span>
                      )}
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
                <div className="mt-6 flex items-center gap-3">
                  {isActive ? (
                    <>
                      <Link
                        href={tool.href}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: tool.color }}
                      >
                        Open in ARIS
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <a
                        href={tool.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Standalone
                      </a>
                    </>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      Integration coming soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Connection Details</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Both BI tools connect to the ARIS PostgreSQL database with read-only access.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Database" value="aris" />
          <InfoCard label="Host" value="localhost:5432" />
          <InfoCard label="Read-Only User" value="aris_bi_reader" />
          <InfoCard label="Sensitive Tables" value="Excluded (User, Session, etc.)" />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
    </div>
  );
}
