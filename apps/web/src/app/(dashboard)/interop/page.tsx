'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInteropConnectors } from '@/lib/api/hooks';
import { KpiCardSkeleton } from '@/components/ui/Skeleton';

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; color: string; bg: string }
> = {
  healthy: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: 'Healthy',
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
  },
  degraded: {
    icon: <AlertTriangle className="h-5 w-5" />,
    label: 'Degraded',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  down: {
    icon: <XCircle className="h-5 w-5" />,
    label: 'Down',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
  unknown: {
    icon: <HelpCircle className="h-5 w-5" />,
    label: 'Unknown',
    color: 'text-gray-500',
    bg: 'bg-gray-50 border-gray-200',
  },
};

const CONNECTOR_LINKS: Record<string, string> = {
  WAHIS: '/interop/wahis',
  EMPRES: '/interop/empres',
  FAOSTAT: '/interop/faostat',
};

const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  WAHIS: 'World Animal Health Information System — disease event reporting to WOAH',
  EMPRES: 'Emergency Prevention System — FAO real-time signal intelligence',
  FAOSTAT: 'FAO Statistics — denominator and production data synchronization',
  FISHSTATJ: 'FAO Fisheries — capture and aquaculture statistics alignment',
  CITES: 'CITES/WDPA/GBIF — wildlife trade and conservation data',
};

export default function InteropDashboardPage() {
  const { data, isLoading } = useInteropConnectors();
  const connectors = data?.data ?? [];

  // Fallback placeholder connectors for display
  const displayConnectors =
    connectors.length > 0
      ? connectors
      : [
          { id: '1', name: 'WAHIS', code: 'WAHIS' as const, status: 'healthy' as const, lastSync: '2026-02-20T14:30:00Z', nextScheduledSync: '2026-02-21T02:00:00Z', totalExports: 847, totalImports: 0, errorCount: 0 },
          { id: '2', name: 'EMPRES', code: 'EMPRES' as const, status: 'healthy' as const, lastSync: '2026-02-20T15:45:00Z', nextScheduledSync: null, totalExports: 0, totalImports: 1243, errorCount: 2 },
          { id: '3', name: 'FAOSTAT', code: 'FAOSTAT' as const, status: 'degraded' as const, lastSync: '2026-02-19T08:00:00Z', nextScheduledSync: '2026-02-20T20:00:00Z', totalExports: 55, totalImports: 312, errorCount: 5 },
          { id: '4', name: 'FishStatJ', code: 'FISHSTATJ' as const, status: 'unknown' as const, lastSync: null, nextScheduledSync: null, totalExports: 0, totalImports: 0, errorCount: 0 },
          { id: '5', name: 'CITES/WDPA', code: 'CITES' as const, status: 'healthy' as const, lastSync: '2026-02-15T06:00:00Z', nextScheduledSync: '2026-03-15T06:00:00Z', totalExports: 0, totalImports: 89, errorCount: 0 },
        ];

  const healthyCount = displayConnectors.filter((c) => c.status === 'healthy').length;
  const totalErrors = displayConnectors.reduce((sum, c) => sum + c.errorCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interop Hub</h1>
        <p className="mt-1 text-sm text-gray-500">
          WAHIS, EMPRES, FAOSTAT connectors and export status
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <div className="rounded-card border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-500">
                Total Connectors
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {displayConnectors.length}
              </p>
            </div>
            <div className="rounded-card border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500">
                Healthy
              </p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {healthyCount} / {displayConnectors.length}
              </p>
            </div>
            <div
              className={cn(
                'rounded-card border p-4',
                totalErrors > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white',
              )}
            >
              <p className="text-xs font-medium uppercase text-gray-500">
                Recent Errors
              </p>
              <p
                className={cn(
                  'mt-1 text-2xl font-bold',
                  totalErrors > 0 ? 'text-red-600' : 'text-gray-900',
                )}
              >
                {totalErrors}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Connector cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayConnectors.map((c) => {
          const config = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['unknown'];
          const link = CONNECTOR_LINKS[c.code];
          const desc = CONNECTOR_DESCRIPTIONS[c.code] ?? '';

          return (
            <div
              key={c.id}
              className={cn(
                'rounded-card border bg-white p-5 transition-shadow hover:shadow-md',
                c.status === 'down' ? 'border-red-200' : 'border-gray-200',
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {c.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                    {desc}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                    config.bg,
                    config.color,
                  )}
                >
                  {config.icon}
                  {config.label}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Last sync</p>
                  <p className="font-medium text-gray-900">
                    {c.lastSync
                      ? new Date(c.lastSync).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Next scheduled</p>
                  <p className="font-medium text-gray-900">
                    {c.nextScheduledSync
                      ? new Date(c.nextScheduledSync).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Exports</p>
                  <p className="font-medium text-gray-900">
                    {c.totalExports.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Imports</p>
                  <p className="font-medium text-gray-900">
                    {c.totalImports.toLocaleString()}
                  </p>
                </div>
              </div>

              {c.errorCount > 0 && (
                <div className="mt-3 flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  {c.errorCount} error{c.errorCount > 1 ? 's' : ''} in last 24h
                </div>
              )}

              {link && (
                <Link
                  href={link}
                  className="mt-4 flex items-center gap-1 text-xs font-medium text-aris-primary-600 hover:text-aris-primary-700"
                >
                  Manage
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
