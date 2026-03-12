'use client';

import React from 'react';
import Link from 'next/link';
import {
  CloudSun,
  Droplets,
  Thermometer,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sprout,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const WaterStressChart = dynamic(() => import('./WaterStressChart'), { ssr: false });
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';

const PLACEHOLDER_KPIS = {
  monitoringStations: 2_840,
  stationsTrend: 6.2,
  waterStressIndex: 42.8,
  waterStressTrend: 3.1,
  rangelandDegradation: 18.5,
  degradationTrend: -1.2,
  climateHotspots: 156,
  hotspotsTrend: 8.7,
};

const PLACEHOLDER_WATER_TRENDS = [
  { year: 2021, eastAfrica: 38.2, westAfrica: 45.1, centralAfrica: 28.5, southernAfrica: 52.3, northAfrica: 68.4 },
  { year: 2022, eastAfrica: 39.5, westAfrica: 44.8, centralAfrica: 29.1, southernAfrica: 53.1, northAfrica: 69.2 },
  { year: 2023, eastAfrica: 40.1, westAfrica: 46.2, centralAfrica: 29.8, southernAfrica: 54.5, northAfrica: 70.1 },
  { year: 2024, eastAfrica: 41.3, westAfrica: 47.0, centralAfrica: 30.2, southernAfrica: 55.8, northAfrica: 71.5 },
  { year: 2025, eastAfrica: 42.0, westAfrica: 47.8, centralAfrica: 30.9, southernAfrica: 56.2, northAfrica: 72.3 },
  { year: 2026, eastAfrica: 42.8, westAfrica: 48.5, centralAfrica: 31.4, southernAfrica: 57.1, northAfrica: 73.0 },
];

const ALERT_FIELDS: AlertField[] = [
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Sahel region', required: true },
  { name: 'hazardType', label: 'Hazard Type', type: 'select', required: true, options: ['Drought', 'Flood', 'Wildfire', 'Desertification', 'Water Contamination', 'Heat Wave', 'Other'] },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
  { name: 'impact', label: 'Impact Description', type: 'textarea', placeholder: 'Describe the environmental impact...' },
];

function TrendIndicator({ value, invertColor }: { value: number; invertColor?: boolean }) {
  const positive = invertColor ? value < 0 : value > 0;
  const negative = invertColor ? value > 0 : value < 0;
  if (value > 0) return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', positive ? 'text-green-600' : 'text-red-600')}>
      <TrendingUp className="h-3 w-3" />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', negative ? 'text-red-600' : 'text-green-600')}>
      <TrendingDown className="h-3 w-3" />{value}%
    </span>
  );
  return <span className="text-xs text-gray-400">0%</span>;
}

export default function ClimateEnvPage() {
  const kpis = PLACEHOLDER_KPIS;
  const waterTrends = PLACEHOLDER_WATER_TRENDS;
  const { sections } = useDomainConfig('climate-env');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Climate & Environment
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Water stress, rangeland degradation, climate hotspots, and environmental monitoring
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {sections.kpis && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Monitoring Stations</p>
            <CloudSun className="h-5 w-5 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.monitoringStations.toLocaleString()}
          </p>
          <TrendIndicator value={kpis.stationsTrend} />
        </div>

        <div className="rounded-card border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Water Stress Index</p>
            <Droplets className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-400">
            {kpis.waterStressIndex}%
          </p>
          <TrendIndicator value={kpis.waterStressTrend} invertColor />
        </div>

        <div className="rounded-card border border-orange-200 bg-orange-50 p-4 shadow-sm dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-orange-600">Rangeland Degradation</p>
            <Sprout className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-700 dark:text-orange-400">
            {kpis.rangelandDegradation}%
          </p>
          <TrendIndicator value={kpis.degradationTrend} invertColor />
        </div>

        <div className="rounded-card border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-red-600">Climate Hotspots</p>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">
            {kpis.climateHotspots}
          </p>
          <TrendIndicator value={kpis.hotspotsTrend} invertColor />
        </div>
      </div>}

      {/* Water Stress Trends Chart */}
      {sections.chart && <div className="rounded-card border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Water Stress Index by Region
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Annual water stress index trends across African regions (% baseline withdrawal)
        </p>
        <div className="mt-4 h-64">
          <WaterStressChart data={waterTrends} />
        </div>
      </div>}

      {/* Quick Links */}
      {sections.quickLinks && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href="/climate-env/climate-data"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-sky-200 hover:bg-sky-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-sky-800 dark:hover:bg-sky-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              <Thermometer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Climate Data</p>
              <p className="text-xs text-gray-400">Temperature & rainfall</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-sky-600" />
        </Link>

        <Link
          href="/climate-env/water-stress"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800 dark:hover:bg-blue-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Water Stress</p>
              <p className="text-xs text-gray-400">Availability & demand</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-600" />
        </Link>

        <Link
          href="/climate-env/rangelands"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-800 dark:hover:bg-orange-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Rangelands</p>
              <p className="text-xs text-gray-400">Degradation & NDVI</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-orange-600" />
        </Link>

        <Link
          href="/climate-env/hotspots"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-red-200 hover:bg-red-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-red-800 dark:hover:bg-red-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Hotspots</p>
              <p className="text-xs text-gray-400">Vulnerability zones</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-red-600" />
        </Link>
      </div>}

      {/* Campaigns & Alert */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="climate_env" />}
          {sections.alertForm && <QuickAlertCard domain="climate_env" alertFields={ALERT_FIELDS} title="Report Environmental Hazard" />}
        </div>
      )}
    </div>
  );
}
