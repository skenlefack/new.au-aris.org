'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  Bug,
  Syringe,
  ClipboardCheck,
  ShieldCheck,
  Activity,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import type { OutbreakMarker } from '@/components/maps/AfricaMap';
import { useTenantStore } from '@/lib/stores/tenant-store';

const AfricaMap = dynamic(
  () =>
    import('@/components/maps/AfricaMap').then((mod) => mod.AfricaMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="flex h-[500px] items-center justify-center rounded-card border border-gray-200 bg-gray-100">
      <p className="text-sm text-gray-400">Loading map...</p>
    </div>
  );
}

// Placeholder outbreak markers across Africa
const PLACEHOLDER_MARKERS: OutbreakMarker[] = [
  {
    id: 'ob-1',
    lat: -1.286,
    lng: 36.817,
    disease: 'Foot-and-Mouth Disease',
    country: 'Kenya',
    severity: 'high',
    cases: 234,
    status: 'confirmed',
  },
  {
    id: 'ob-2',
    lat: 9.005,
    lng: 38.763,
    disease: 'Peste des Petits Ruminants',
    country: 'Ethiopia',
    severity: 'critical',
    cases: 412,
    status: 'confirmed',
  },
  {
    id: 'ob-3',
    lat: 9.06,
    lng: 7.49,
    disease: 'Highly Pathogenic Avian Influenza',
    country: 'Nigeria',
    severity: 'critical',
    cases: 89,
    status: 'confirmed',
  },
  {
    id: 'ob-4',
    lat: 14.693,
    lng: -17.444,
    disease: 'African Swine Fever',
    country: 'Senegal',
    severity: 'medium',
    cases: 45,
    status: 'suspected',
  },
  {
    id: 'ob-5',
    lat: -6.162,
    lng: 35.75,
    disease: 'Rift Valley Fever',
    country: 'Tanzania',
    severity: 'low',
    cases: 12,
    status: 'resolved',
  },
  {
    id: 'ob-6',
    lat: -25.747,
    lng: 28.229,
    disease: 'FMD',
    country: 'South Africa',
    severity: 'medium',
    cases: 67,
    status: 'confirmed',
  },
  {
    id: 'ob-7',
    lat: 5.614,
    lng: -0.186,
    disease: 'Newcastle Disease',
    country: 'Ghana',
    severity: 'low',
    cases: 23,
    status: 'confirmed',
  },
  {
    id: 'ob-8',
    lat: 0.347,
    lng: 32.582,
    disease: 'PPR',
    country: 'Uganda',
    severity: 'medium',
    cases: 78,
    status: 'confirmed',
  },
  {
    id: 'ob-9',
    lat: 33.894,
    lng: 35.503,
    disease: 'Lumpy Skin Disease',
    country: 'Egypt',
    severity: 'high',
    cases: 156,
    status: 'confirmed',
  },
  {
    id: 'ob-10',
    lat: -4.441,
    lng: 15.266,
    disease: 'HPAI',
    country: 'DR Congo',
    severity: 'low',
    cases: 8,
    status: 'suspected',
  },
];

// Placeholder recent activity
const RECENT_ACTIVITY = [
  {
    id: '1',
    action: 'Outbreak reported',
    detail: 'FMD in Rift Valley, Kenya',
    actor: 'Dr. Ochieng',
    time: '12 min ago',
    icon: <Bug className="h-4 w-4 text-red-500" />,
  },
  {
    id: '2',
    action: 'Validation approved',
    detail: 'PPR vaccination data — Uganda (L2)',
    actor: 'Dr. Nakato',
    time: '34 min ago',
    icon: <ClipboardCheck className="h-4 w-4 text-green-600" />,
  },
  {
    id: '3',
    action: 'WAHIS export triggered',
    detail: 'Monthly report — Ethiopia',
    actor: 'System',
    time: '1 hr ago',
    icon: <ArrowUpRight className="h-4 w-4 text-aris-secondary-600" />,
  },
  {
    id: '4',
    action: 'Campaign launched',
    detail: 'Rinderpest surveillance — IGAD region',
    actor: 'Dr. Abdi',
    time: '2 hr ago',
    icon: <Activity className="h-4 w-4 text-aris-primary-600" />,
  },
  {
    id: '5',
    action: 'Quality gate failed',
    detail: 'Missing species code — Nigeria submission',
    actor: 'System',
    time: '3 hr ago',
    icon: <ShieldCheck className="h-4 w-4 text-amber-600" />,
  },
];

interface KpiCardData {
  label: string;
  value: string | number;
  unit?: string;
  trend: { direction: 'up' | 'down' | 'neutral'; value: string; label: string };
  variant: 'default' | 'primary' | 'secondary' | 'accent';
  icon: React.ReactNode;
}

export default function DashboardHomePage() {
  const selectedTenant = useTenantStore((s) => s.selectedTenant);

  const kpis: KpiCardData[] = [
    {
      label: 'Active Outbreaks',
      value: 42,
      trend: { direction: 'up', value: '+12%', label: 'vs last month' },
      variant: 'accent',
      icon: <Bug className="h-5 w-5" />,
    },
    {
      label: 'Vaccination Coverage',
      value: '87.3',
      unit: '%',
      trend: { direction: 'up', value: '+5.2%', label: 'vs last quarter' },
      variant: 'primary',
      icon: <Syringe className="h-5 w-5" />,
    },
    {
      label: 'Pending Validations',
      value: 156,
      trend: { direction: 'down', value: '-8%', label: 'improving' },
      variant: 'default',
      icon: <ClipboardCheck className="h-5 w-5" />,
    },
    {
      label: 'Data Quality Score',
      value: '94.1',
      unit: '%',
      trend: { direction: 'neutral', value: '0%', label: 'stable' },
      variant: 'secondary',
      icon: <ShieldCheck className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Continental overview
          {selectedTenant ? ` — ${selectedTenant.name}` : ''}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Map + Activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Outbreak Map
            </h2>
            <span className="text-xs text-gray-400">
              {PLACEHOLDER_MARKERS.length} active events
            </span>
          </div>
          <AfricaMap markers={PLACEHOLDER_MARKERS} height="500px" />
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
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

        {/* Recent activity */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
          <div className="rounded-card border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {RECENT_ACTIVITY.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.action}
                      </p>
                      <p className="text-xs text-gray-500">{item.detail}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span>{item.actor}</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline KpiCard for the dashboard (uses same ARIS styling as @aris/ui-components)
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
