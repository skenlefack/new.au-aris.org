'use client';

import React from 'react';
import Link from 'next/link';
import {
  PawPrint,
  TreePine,
  FileCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const InventoryChart = dynamic(() => import('./InventoryChart'), { ssr: false });
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';

const PLACEHOLDER_KPIS = {
  protectedAreas: 1_240,
  protectedAreasTrend: 2.1,
  speciesInventoried: 8_450,
  speciesTrend: 5.3,
  citesPermits: 3_120,
  permitsTrend: -1.8,
  wildlifeCrimes: 187,
  crimesTrend: -12.4,
};

const PLACEHOLDER_INVENTORY = [
  { category: 'Mammals', endangered: 142, vulnerable: 285, leastConcern: 1_820 },
  { category: 'Birds', endangered: 98, vulnerable: 213, leastConcern: 2_450 },
  { category: 'Reptiles', endangered: 67, vulnerable: 145, leastConcern: 890 },
  { category: 'Amphibians', endangered: 89, vulnerable: 124, leastConcern: 520 },
  { category: 'Fish', endangered: 53, vulnerable: 178, leastConcern: 1_340 },
];

const ALERT_FIELDS: AlertField[] = [
  { name: 'species', label: 'Species', type: 'text', placeholder: 'e.g. African Elephant', required: true },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Serengeti, TZ', required: true },
  { name: 'threatType', label: 'Threat Type', type: 'select', required: true, options: ['Poaching', 'Habitat Loss', 'Human-Wildlife Conflict', 'Disease', 'Trafficking', 'Other'] },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the incident...' },
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

export default function WildlifePage() {
  const kpis = PLACEHOLDER_KPIS;
  const inventory = PLACEHOLDER_INVENTORY;
  const { sections } = useDomainConfig('wildlife');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Wildlife & Biodiversity
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Species inventories, protected areas, CITES permits, and wildlife crime
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {sections.kpis && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Protected Areas</p>
            <TreePine className="h-5 w-5 text-green-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.protectedAreas.toLocaleString()}
          </p>
          <TrendIndicator value={kpis.protectedAreasTrend} />
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Species Inventoried</p>
            <PawPrint className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.speciesInventoried.toLocaleString()}
          </p>
          <TrendIndicator value={kpis.speciesTrend} />
        </div>

        <div className="rounded-card border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">CITES Permits</p>
            <FileCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {kpis.citesPermits.toLocaleString()}
          </p>
          <TrendIndicator value={kpis.permitsTrend} />
        </div>

        <div className="rounded-card border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-red-600">Wildlife Crimes</p>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">
            {kpis.wildlifeCrimes}
          </p>
          <TrendIndicator value={kpis.crimesTrend} />
        </div>
      </div>}

      {/* Species Inventory Chart */}
      {sections.chart && <div className="rounded-card border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Species Inventory by Conservation Status
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Continental species count by taxonomic category and IUCN status
        </p>
        <div className="mt-4 h-64">
          <InventoryChart data={inventory} />
        </div>
      </div>}

      {/* Quick Links */}
      {sections.quickLinks && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/wildlife/inventory"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-amber-200 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-amber-800 dark:hover:bg-amber-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <PawPrint className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Inventory</p>
              <p className="text-xs text-gray-400">Species records & census</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-amber-600" />
        </Link>

        <Link
          href="/wildlife/protected-areas"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-green-200 hover:bg-green-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-800 dark:hover:bg-green-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <TreePine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Protected Areas</p>
              <p className="text-xs text-gray-400">Parks, reserves & WDPA</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-green-600" />
        </Link>

        <Link
          href="/wildlife/cites"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">CITES Permits</p>
              <p className="text-xs text-gray-400">Trade permits & compliance</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-emerald-600" />
        </Link>
      </div>}

      {/* Campaigns & Alert */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="wildlife" />}
          {sections.alertForm && <QuickAlertCard domain="wildlife" alertFields={ALERT_FIELDS} title="Report Wildlife Threat" />}
        </div>
      )}
    </div>
  );
}
