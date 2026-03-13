'use client';

import React from 'react';
import Link from 'next/link';
import {
  Cloud,
  Droplets,
  TreePine,
  Flame,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Thermometer,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const ClimateChart = dynamic(() => import('./ClimateChart'), { ssr: false });
import {
  useClimateEnvKpis,
  type ClimateEnvKpis,
} from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';

const CLIMATE_ALERT_FIELDS: AlertField[] = [
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Sahel region, Niger', required: true },
  { name: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['Drought', 'Flood', 'Heat Wave', 'Desertification', 'Water Scarcity', 'Other'] },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['Low', 'Moderate', 'High', 'Critical'] },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the climate event...' },
];

const PLACEHOLDER_KPIS: ClimateEnvKpis = {
  monitoringStations: 1_840,
  waterStressIndex: 42.5,
  rangelandDegradation: 18.7,
  climateHotspots: 156,
};

const PLACEHOLDER_TRENDS = [
  { year: 2021, temperature: 25.2, rainfall: 820 },
  { year: 2022, temperature: 25.5, rainfall: 790 },
  { year: 2023, temperature: 25.8, rainfall: 760 },
  { year: 2024, temperature: 26.1, rainfall: 745 },
  { year: 2025, temperature: 26.3, rainfall: 730 },
  { year: 2026, temperature: 26.5, rainfall: 715 },
];

export default function ClimatePage() {
  const { data: kpiData, isLoading: kpiLoading } = useClimateEnvKpis();
  const { sections } = useDomainConfig('climate-env');

  const kpis = { ...PLACEHOLDER_KPIS, ...kpiData };
  const trends = PLACEHOLDER_TRENDS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Climate & Environment
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Water stress, rangelands, climate hotspots, and environmental monitoring
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
                Monitoring Stations
              </p>
              <Cloud className="h-5 w-5 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.monitoringStations.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Across 55 member states
            </p>
          </div>

          <div className="rounded-card border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
                Water Stress Index
              </p>
              <Droplets className="h-5 w-5 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-700">
              {kpis.waterStressIndex.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-blue-400">
              Continental average
            </p>
          </div>

          <div className="rounded-card border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-orange-600">
                Rangeland Degradation
              </p>
              <TreePine className="h-5 w-5 text-orange-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-orange-700">
              {kpis.rangelandDegradation.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-orange-400">
              Area affected
            </p>
          </div>

          <div className="rounded-card border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-red-600">
                Climate Hotspots
              </p>
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {kpis.climateHotspots}
            </p>
            <p className="mt-1 text-xs text-red-400">
              Active vulnerability zones
            </p>
          </div>
        </div>
      ))}

      {/* Climate trends chart */}
      {sections.chart && (
        <div className="rounded-card border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">
            Temperature & Rainfall Trends
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Continental averages (2021-2026)
          </p>
          <div className="mt-4 h-64">
            <ClimateChart data={trends} />
          </div>
        </div>
      )}

      {/* Quick links to sub-pages */}
      {sections.quickLinks && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/climate/water-stress"
            className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Water Stress</p>
                <p className="text-xs text-gray-400">Water availability & stress indices</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-600" />
          </Link>

          <Link
            href="/climate/rangelands"
            className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-green-200 hover:bg-green-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <TreePine className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Rangelands</p>
                <p className="text-xs text-gray-400">Vegetation & degradation monitoring</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-green-600" />
          </Link>

          <Link
            href="/climate/hotspots"
            className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-red-200 hover:bg-red-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Hotspots</p>
                <p className="text-xs text-gray-400">Climate vulnerability zones</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-red-600" />
          </Link>

          <Link
            href="/climate/data"
            className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-teal-200 hover:bg-teal-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                <Thermometer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Climate Data</p>
                <p className="text-xs text-gray-400">Temperature, rainfall & wind</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-teal-600" />
          </Link>
        </div>
      )}

      {/* Campaigns & Alert */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="climate-env" />}
          {sections.alertForm && <QuickAlertCard domain="climate-env" alertFields={CLIMATE_ALERT_FIELDS} title="Report Climate Event" />}
        </div>
      )}
    </div>
  );
}
