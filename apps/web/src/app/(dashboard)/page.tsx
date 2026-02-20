'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Bug,
  Syringe,
  ClipboardCheck,
  ShieldCheck,
  FlaskConical,
  TrendingUp,
  PawPrint,
  Megaphone,
  Activity,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  X,
  ChevronRight,
} from 'lucide-react';
import type { OutbreakMarker } from '@/components/maps/AfricaMap';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  useDashboardKpisRange,
  useOutbreakMarkers,
  useOutbreakAlerts,
  useRealtimeEvents,
  type TimeRange,
  type RealtimeEvent,
} from '@/lib/api/hooks';
import { KpiCardSkeleton, MapSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

const AfricaMap = dynamic(
  () =>
    import('@/components/maps/AfricaMap').then((mod) => mod.AfricaMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

// Fallback markers when API is unavailable
const FALLBACK_MARKERS: OutbreakMarker[] = [
  { id: 'ob-1', lat: -1.286, lng: 36.817, disease: 'Foot-and-Mouth Disease', country: 'Kenya', severity: 'high', cases: 234, status: 'confirmed' },
  { id: 'ob-2', lat: 9.005, lng: 38.763, disease: 'Peste des Petits Ruminants', country: 'Ethiopia', severity: 'critical', cases: 412, status: 'confirmed' },
  { id: 'ob-3', lat: 9.06, lng: 7.49, disease: 'Highly Pathogenic Avian Influenza', country: 'Nigeria', severity: 'critical', cases: 89, status: 'confirmed' },
  { id: 'ob-4', lat: 14.693, lng: -17.444, disease: 'African Swine Fever', country: 'Senegal', severity: 'medium', cases: 45, status: 'suspected' },
  { id: 'ob-5', lat: -6.162, lng: 35.75, disease: 'Rift Valley Fever', country: 'Tanzania', severity: 'low', cases: 12, status: 'resolved' },
  { id: 'ob-6', lat: -25.747, lng: 28.229, disease: 'FMD', country: 'South Africa', severity: 'medium', cases: 67, status: 'confirmed' },
  { id: 'ob-7', lat: 5.614, lng: -0.186, disease: 'Newcastle Disease', country: 'Ghana', severity: 'low', cases: 23, status: 'confirmed' },
  { id: 'ob-8', lat: 0.347, lng: 32.582, disease: 'PPR', country: 'Uganda', severity: 'medium', cases: 78, status: 'confirmed' },
  { id: 'ob-9', lat: 30.044, lng: 31.236, disease: 'Lumpy Skin Disease', country: 'Egypt', severity: 'high', cases: 156, status: 'confirmed' },
  { id: 'ob-10', lat: -4.441, lng: 15.266, disease: 'HPAI', country: 'DR Congo', severity: 'low', cases: 8, status: 'suspected' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

interface KpiCardData {
  label: string;
  value: string | number;
  unit?: string;
  trend: { direction: 'up' | 'down' | 'neutral'; value: string; label: string };
  variant: 'default' | 'primary' | 'secondary' | 'accent';
  icon: React.ReactNode;
}

function formatTrend(val: number): { direction: 'up' | 'down' | 'neutral'; value: string } {
  if (val > 0) return { direction: 'up', value: `+${val}%` };
  if (val < 0) return { direction: 'down', value: `${val}%` };
  return { direction: 'neutral', value: '0%' };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const EVENT_ICONS: Record<RealtimeEvent['type'], React.ReactNode> = {
  outbreak: <Bug className="h-4 w-4 text-red-500" />,
  validation: <ClipboardCheck className="h-4 w-4 text-green-600" />,
  export: <ArrowUpRight className="h-4 w-4 text-aris-secondary-600" />,
  campaign: <Activity className="h-4 w-4 text-aris-primary-600" />,
  quality: <ShieldCheck className="h-4 w-4 text-amber-600" />,
  submission: <ClipboardCheck className="h-4 w-4 text-blue-600" />,
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardHomePage() {
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const { data: kpiData, isLoading: kpisLoading } = useDashboardKpisRange(timeRange);
  const { data: markersData } = useOutbreakMarkers();
  const { data: alertsData } = useOutbreakAlerts();
  const { data: eventsData } = useRealtimeEvents(20);

  const kpiValues = kpiData?.data;
  const markers: OutbreakMarker[] = markersData?.data ?? FALLBACK_MARKERS;
  const alerts = (alertsData?.data ?? []).filter((a) => !dismissedAlerts.has(a.id));
  const events = eventsData?.data ?? [];

  // WebSocket connection for real-time updates
  useEffect(() => {
    let socket: ReturnType<typeof import('socket.io-client').io> | null = null;

    async function connectWs() {
      try {
        const { io } = await import('socket.io-client');
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3008';
        socket = io(wsUrl, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
        });
      } catch {
        // WebSocket unavailable — silent fallback to polling
      }
    }

    connectWs();

    return () => {
      socket?.disconnect();
    };
  }, []);

  const kpis: KpiCardData[] = kpiValues
    ? [
        {
          label: 'Active Outbreaks',
          value: kpiValues.activeOutbreaks,
          trend: { ...formatTrend(kpiValues.outbreaksTrend), label: 'vs prev. period' },
          variant: 'accent',
          icon: <Bug className="h-5 w-5" />,
        },
        {
          label: 'Vaccination Coverage',
          value: kpiValues.vaccinationCoverage.toFixed(1),
          unit: '%',
          trend: { ...formatTrend(kpiValues.vaccinationTrend), label: 'vs prev. period' },
          variant: 'primary',
          icon: <Syringe className="h-5 w-5" />,
        },
        {
          label: 'Lab Turnaround',
          value: kpiValues.labTurnaround.toFixed(1),
          unit: 'days',
          trend: { ...formatTrend(kpiValues.labTurnaroundTrend), label: kpiValues.labTurnaroundTrend <= 0 ? 'faster' : 'slower' },
          variant: 'secondary',
          icon: <FlaskConical className="h-5 w-5" />,
        },
        {
          label: 'Data Quality',
          value: kpiValues.dataQualityScore.toFixed(1),
          unit: '%',
          trend: { ...formatTrend(kpiValues.qualityTrend), label: kpiValues.qualityTrend === 0 ? 'stable' : 'vs prev. period' },
          variant: 'default',
          icon: <ShieldCheck className="h-5 w-5" />,
        },
        {
          label: 'Pending Workflows',
          value: kpiValues.pendingValidations,
          trend: { ...formatTrend(kpiValues.validationsTrend), label: kpiValues.validationsTrend <= 0 ? 'improving' : 'vs prev. period' },
          variant: 'default',
          icon: <ClipboardCheck className="h-5 w-5" />,
        },
        {
          label: 'Trade Volume',
          value: formatCompact(kpiValues.tradeVolume),
          unit: 'USD',
          trend: { ...formatTrend(kpiValues.tradeVolumeTrend), label: 'vs prev. period' },
          variant: 'primary',
          icon: <TrendingUp className="h-5 w-5" />,
        },
        {
          label: 'Livestock Population',
          value: formatCompact(kpiValues.livestockPopulation),
          unit: 'heads',
          trend: { ...formatTrend(kpiValues.livestockTrend), label: 'annual change' },
          variant: 'secondary',
          icon: <PawPrint className="h-5 w-5" />,
        },
        {
          label: 'Active Campaigns',
          value: kpiValues.activeCampaigns,
          trend: { ...formatTrend(kpiValues.campaignsTrend), label: 'vs prev. period' },
          variant: 'accent',
          icon: <Megaphone className="h-5 w-5" />,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3',
            alert.severity === 'critical'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          <AlertTriangle
            className={cn(
              'mt-0.5 h-5 w-5 flex-shrink-0',
              alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{alert.title}</p>
            <p className="mt-0.5 text-sm opacity-90">{alert.message}</p>
          </div>
          <button
            onClick={() => setDismissedAlerts((s) => new Set([...s, alert.id]))}
            className="flex-shrink-0 rounded p-1 hover:bg-black/5"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Header + Time Range Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Continental overview
            {selectedTenant ? ` — ${selectedTenant.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                timeRange === tr.value
                  ? 'bg-aris-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards — 2 rows of 4 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpisLoading
          ? Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Map + Activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Continental Map */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Continental Outbreak Map
            </h2>
            <Link
              href="/animal-health/map"
              className="flex items-center gap-1 text-xs text-aris-primary-600 hover:underline"
            >
              {markers.length} active events
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <AfricaMap markers={markers} height="500px" />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />
              Low
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F57F17]" />
              Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E65100]" />
              High
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C62828]" />
              Critical
            </span>
          </div>
        </div>

        {/* Real-time Activity Feed */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Live Activity
            </h2>
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live
            </span>
          </div>
          <div className="rounded-card border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100 max-h-[540px] overflow-y-auto">
              {events.map((event) => (
                <li key={event.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {EVENT_ICONS[event.type] ?? <Activity className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {event.action}
                      </p>
                      <p className="text-xs text-gray-500">{event.detail}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span>{event.actor}</span>
                        {event.country && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{event.country}</span>
                          </>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {events.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-400">
                  No recent activity
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink
          href="/analytics"
          title="Analytics"
          description="Trends, comparisons, and quality drill-downs"
        />
        <QuickLink
          href="/reports"
          title="Reports"
          description="WAHIS, continental briefs, and custom reports"
        />
        <QuickLink
          href="/animal-health"
          title="Animal Health"
          description="Events, outbreaks, vaccination, and labs"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  trend,
  variant,
  icon,
}: KpiCardData) {
  const variantStyles = {
    default: 'border-gray-200 bg-white',
    primary: 'border-aris-primary-200 bg-aris-primary-50',
    secondary: 'border-aris-secondary-200 bg-aris-secondary-50',
    accent: 'border-aris-accent-200 bg-aris-accent-50',
  };

  const trendStyles = {
    up: 'text-green-700',
    down: 'text-red-700',
    neutral: 'text-gray-500',
  };

  return (
    <div
      className={`rounded-card border p-card shadow-sm transition-shadow hover:shadow-md ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-kpi-label uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-kpi text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      <div
        className={`mt-3 flex items-center gap-1 text-sm ${trendStyles[trend.direction]}`}
      >
        <span className="font-medium">{trend.value}</span>
        <span className="text-gray-500">{trend.label}</span>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
