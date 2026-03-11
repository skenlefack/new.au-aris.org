'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bug,
  Hexagon,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Droplets,
  HeartPulse,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';

const PLACEHOLDER_KPIS = {
  registeredApiaries: 24_500,
  apiariesTrend: 4.7,
  activeColonies: 312_000,
  coloniesTrend: 2.3,
  honeyProduction: 185_000,
  productionTrend: 6.1,
  colonyLossRate: 14.2,
  lossRateTrend: -3.5,
};

const PLACEHOLDER_TRENDS = [
  { year: 2021, honey: 142_000, wax: 18_000, propolis: 3_200 },
  { year: 2022, honey: 151_000, wax: 19_500, propolis: 3_800 },
  { year: 2023, honey: 158_000, wax: 20_200, propolis: 4_100 },
  { year: 2024, honey: 168_000, wax: 21_800, propolis: 4_600 },
  { year: 2025, honey: 176_000, wax: 22_500, propolis: 5_000 },
  { year: 2026, honey: 185_000, wax: 23_400, propolis: 5_400 },
];

const ALERT_FIELDS: AlertField[] = [
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Addis Ababa region', required: true },
  { name: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['Colony Collapse', 'Pest Infestation', 'Disease Outbreak', 'Pesticide Exposure', 'Swarming', 'Other'] },
  { name: 'coloniesAffected', label: 'Colonies Affected', type: 'text', placeholder: 'e.g. 50' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the issue...' },
];

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
      <TrendingUp className="h-3 w-3" />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-red-600">
      <TrendingDown className="h-3 w-3" />{value}%
    </span>
  );
  return <span className="text-xs text-gray-400">0%</span>;
}

export default function ApiculturePage() {
  const kpis = PLACEHOLDER_KPIS;
  const trends = PLACEHOLDER_TRENDS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Apiculture & Pollination
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Apiaries, colony health, honey production, and pollination services
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Registered Apiaries</p>
            <Hexagon className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.registeredApiaries.toLocaleString()}
          </p>
          <TrendIndicator value={kpis.apiariesTrend} />
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Active Colonies</p>
            <Bug className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {(kpis.activeColonies / 1_000).toFixed(0)}K
          </p>
          <TrendIndicator value={kpis.coloniesTrend} />
        </div>

        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Honey Production</p>
            <Droplets className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
            {(kpis.honeyProduction / 1_000).toFixed(0)}K t
          </p>
          <TrendIndicator value={kpis.productionTrend} />
        </div>

        <div className="rounded-card border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-red-600">Colony Loss Rate</p>
            <HeartPulse className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">
            {kpis.colonyLossRate}%
          </p>
          <TrendIndicator value={kpis.lossRateTrend} />
        </div>
      </div>

      {/* Production Trends Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Production Trends
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Continental bee product output in tonnes (2021-2026)
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="honeyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="waxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#92400E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#92400E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="propolisGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#065F46" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#065F46" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickFormatter={(v) => `${(v / 1_000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => [`${value.toLocaleString()} tonnes`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="honey" stackId="1" stroke="#D97706" strokeWidth={2} fill="url(#honeyGrad)" name="Honey" />
              <Area type="monotone" dataKey="wax" stackId="1" stroke="#92400E" strokeWidth={2} fill="url(#waxGrad)" name="Beeswax" />
              <Area type="monotone" dataKey="propolis" stackId="1" stroke="#065F46" strokeWidth={2} fill="url(#propolisGrad)" name="Propolis" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/apiculture/apiaries"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-amber-200 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-amber-800 dark:hover:bg-amber-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Hexagon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Apiaries</p>
              <p className="text-xs text-gray-400">Registered apiary locations</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-amber-600" />
        </Link>

        <Link
          href="/apiculture/colony-health"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-red-200 hover:bg-red-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-red-800 dark:hover:bg-red-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Colony Health</p>
              <p className="text-xs text-gray-400">Diseases, pests & losses</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-red-600" />
        </Link>

        <Link
          href="/apiculture/production"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-yellow-200 hover:bg-yellow-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-yellow-800 dark:hover:bg-yellow-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Production</p>
              <p className="text-xs text-gray-400">Honey, wax & propolis output</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-yellow-600" />
        </Link>
      </div>

      {/* Campaigns & Alert */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DomainCampaignsSection domain="apiculture" />
        <QuickAlertCard domain="apiculture" alertFields={ALERT_FIELDS} title="Report Colony Issue" />
      </div>
    </div>
  );
}
