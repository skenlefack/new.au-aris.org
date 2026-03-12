'use client';

import React from 'react';
import Link from 'next/link';
import {
  Anchor,
  Ship,
  Warehouse,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Fish,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const CaptureTrendsChart = dynamic(() => import('./CaptureTrendsChart'), { ssr: false });
import {
  useFisheriesKpis,
  useCaptureTrends,
  type FisheriesKpis,
  type CaptureTrend,
} from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';

const FISHERIES_ALERT_FIELDS: AlertField[] = [
  { name: 'species', label: 'Species', type: 'text', placeholder: 'e.g. Nile Perch', required: true },
  { name: 'area', label: 'Fishing Area', type: 'text', placeholder: 'e.g. Lake Victoria', required: true },
  { name: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['IUU Fishing', 'Stock Depletion', 'Aquatic Disease', 'License Violation', 'Environmental Impact', 'Other'] },
  { name: 'vessels', label: 'Vessels Involved', type: 'text', placeholder: 'e.g. 5' },
];

const PLACEHOLDER_KPIS: FisheriesKpis['data'] = {
  totalCaptures: 12_450_000,
  capturesTrend: 3.2,
  registeredVessels: 8_740,
  activeFarms: 1_260,
  aquacultureProduction: 2_870_000,
  aquacultureTrend: 7.8,
  licensesExpiringSoon: 312,
  countriesReporting: 38,
};

const PLACEHOLDER_TRENDS: CaptureTrend[] = [
  { year: 2021, marine: 5_200_000, inland: 3_100_000, aquaculture: 1_800_000 },
  { year: 2022, marine: 5_400_000, inland: 3_250_000, aquaculture: 2_050_000 },
  { year: 2023, marine: 5_350_000, inland: 3_300_000, aquaculture: 2_300_000 },
  { year: 2024, marine: 5_500_000, inland: 3_400_000, aquaculture: 2_520_000 },
  { year: 2025, marine: 5_600_000, inland: 3_450_000, aquaculture: 2_700_000 },
  { year: 2026, marine: 5_750_000, inland: 3_500_000, aquaculture: 2_870_000 },
];

export default function FisheriesPage() {
  const { data: kpiData, isLoading: kpiLoading } = useFisheriesKpis();
  const { data: trendData, isLoading: trendLoading } = useCaptureTrends();
  const { sections } = useDomainConfig('fisheries');

  const kpis = { ...PLACEHOLDER_KPIS, ...kpiData?.data };
  const trends = trendData?.data?.length ? trendData.data : PLACEHOLDER_TRENDS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Fisheries & Aquaculture
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Captures, vessel registry, aquaculture farms, and production trends
          </p>
        </div>
      </div>

      {/* KPI cards */}
      {sections.kpis && (kpiLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-card border border-gray-200 bg-white p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-3 h-4 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Captures
              </p>
              <Fish className="h-5 w-5 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {(kpis.totalCaptures / 1_000_000).toFixed(1)}M
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {kpis.capturesTrend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span
                className={cn(
                  'font-medium',
                  kpis.capturesTrend >= 0 ? 'text-green-600' : 'text-red-600',
                )}
              >
                {kpis.capturesTrend >= 0 ? '+' : ''}
                {kpis.capturesTrend}%
              </span>
              <span className="text-gray-400">vs last year</span>
            </div>
          </div>

          <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Registered Vessels
              </p>
              <Ship className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.registeredVessels.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {kpis.licensesExpiringSoon} licenses expiring soon
            </p>
          </div>

          <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Active Farms
              </p>
              <Warehouse className="h-5 w-5 text-green-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.activeFarms.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {kpis.countriesReporting} countries reporting
            </p>
          </div>

          <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Aquaculture Production
              </p>
              <Anchor className="h-5 w-5 text-orange-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {(kpis.aquacultureProduction / 1_000_000).toFixed(1)}M
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {kpis.aquacultureTrend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span
                className={cn(
                  'font-medium',
                  kpis.aquacultureTrend >= 0 ? 'text-green-600' : 'text-red-600',
                )}
              >
                {kpis.aquacultureTrend >= 0 ? '+' : ''}
                {kpis.aquacultureTrend}%
              </span>
              <span className="text-gray-400">vs last year</span>
            </div>
          </div>
        </div>
      ))}

      {/* Capture trends chart */}
      {sections.chart && <div className="rounded-card border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Capture & Aquaculture Production Trends
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Continental totals in tonnes by source (2021-2026)
        </p>
        {trendLoading ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : (
          <div className="mt-4 h-64">
            <CaptureTrendsChart data={trends} />
          </div>
        )}
      </div>}

      {/* Quick links to sub-pages */}
      {sections.quickLinks && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/fisheries/captures"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-teal-200 hover:bg-teal-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
              <Fish className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Captures</p>
              <p className="text-xs text-gray-400">
                Marine & inland capture records
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-teal-600" />
        </Link>

        <Link
          href="/fisheries/vessels"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Vessel Registry
              </p>
              <p className="text-xs text-gray-400">
                Fishing fleet & license management
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-600" />
        </Link>

        <Link
          href="/fisheries/aquaculture"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Aquaculture Farms
              </p>
              <p className="text-xs text-gray-400">
                Farm production & management
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-orange-600" />
        </Link>
      </div>}

      {/* Campaigns & Alert */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="fisheries" />}
          {sections.alertForm && <QuickAlertCard domain="fisheries" alertFields={FISHERIES_ALERT_FIELDS} title="Report Fisheries Issue" />}
        </div>
      )}
    </div>
  );
}
