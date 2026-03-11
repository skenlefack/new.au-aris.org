'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Globe,
  BarChart3,
  Route,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useLivestockKpis,
  useLivestockCensus,
  type LivestockKpis,
  type LivestockCensus,
} from '@/lib/api/hooks';
import { TableSkeleton, KpiCardSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';

const LIVESTOCK_ALERT_FIELDS: AlertField[] = [
  { name: 'species', label: 'Species', type: 'text', placeholder: 'e.g. Cattle', required: true },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Oromia, ET', required: true },
  { name: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['Census Discrepancy', 'Movement Restriction', 'Feed Shortage', 'Market Disruption', 'Other'] },
  { name: 'count', label: 'Estimated Count', type: 'text', placeholder: 'e.g. 1000' },
];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-700',
  validated: 'bg-green-100 text-green-700',
  published: 'bg-gray-100 text-gray-600',
};

const PLACEHOLDER_KPIS: LivestockKpis['data'] = {
  totalPopulation: 456_200_000,
  populationTrend: 3.2,
  countriesReporting: 42,
  speciesTracked: 18,
  productionVolume: 12_500_000,
  productionTrend: 5.1,
  activeCorridors: 37,
  corridorsTrend: -2,
};

const PLACEHOLDER_CENSUS: LivestockCensus[] = [
  {
    id: 'lc-1', country: 'Ethiopia', countryCode: 'ET', region: 'Oromia',
    species: 'Cattle', year: 2025, population: 65_400_000,
    femaleBreeding: 28_200_000, maleBreeding: 15_300_000, young: 21_900_000,
    source: 'National Census 2025', status: 'validated',
    createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-10T14:00:00Z',
  },
  {
    id: 'lc-2', country: 'Nigeria', countryCode: 'NG', region: 'Kano',
    species: 'Cattle', year: 2025, population: 20_700_000,
    femaleBreeding: 8_900_000, maleBreeding: 4_800_000, young: 7_000_000,
    source: 'FAOSTAT Estimate', status: 'published',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-02-05T12:00:00Z',
  },
  {
    id: 'lc-3', country: 'Kenya', countryCode: 'KE', region: 'Rift Valley',
    species: 'Sheep', year: 2025, population: 17_100_000,
    femaleBreeding: 7_500_000, maleBreeding: 3_200_000, young: 6_400_000,
    source: 'National Census 2025', status: 'validated',
    createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-02-12T11:00:00Z',
  },
  {
    id: 'lc-4', country: 'Tanzania', countryCode: 'TZ', region: 'Arusha',
    species: 'Goat', year: 2025, population: 18_300_000,
    femaleBreeding: 8_100_000, maleBreeding: 3_600_000, young: 6_600_000,
    source: 'National Census 2025', status: 'draft',
    createdAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'lc-5', country: 'South Africa', countryCode: 'ZA', region: 'KwaZulu-Natal',
    species: 'Cattle', year: 2025, population: 12_500_000,
    femaleBreeding: 5_400_000, maleBreeding: 2_900_000, young: 4_200_000,
    source: 'FAOSTAT Estimate', status: 'published',
    createdAt: '2025-12-15T10:00:00Z', updatedAt: '2026-01-28T16:00:00Z',
  },
];

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
        <TrendingUp className="h-3 w-3" />
        +{value}%
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-red-600">
        <TrendingDown className="h-3 w-3" />
        {value}%
      </span>
    );
  }
  return <span className="text-xs text-gray-400">0%</span>;
}

export default function LivestockPage() {
  const { data: kpiData, isLoading: kpisLoading } = useLivestockKpis();
  const {
    data: censusData,
    isLoading: censusLoading,
    isError: censusError,
    error: censusErr,
    refetch: refetchCensus,
  } = useLivestockCensus({ limit: 5 });

  const kpis = kpiData?.data ?? PLACEHOLDER_KPIS;
  const censusList = censusData?.data ?? PLACEHOLDER_CENSUS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Livestock & Production
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Census data, production statistics, and transhumance corridors
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-400">Total Population</p>
              <Globe className="h-4 w-4 text-gray-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {(kpis.totalPopulation / 1_000_000).toFixed(1)}M
            </p>
            <TrendIndicator value={kpis.populationTrend} />
          </div>
          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-400">Countries Reporting</p>
              <Globe className="h-4 w-4 text-gray-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.countriesReporting}
            </p>
            <p className="text-xs text-gray-400">
              {kpis.speciesTracked} species tracked
            </p>
          </div>
          <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs text-aris-primary-600">Production Volume</p>
              <BarChart3 className="h-4 w-4 text-aris-primary-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-aris-primary-700">
              {(kpis.productionVolume / 1_000_000).toFixed(1)}M t
            </p>
            <TrendIndicator value={kpis.productionTrend} />
          </div>
          <div className="rounded-card border border-orange-200 bg-orange-50 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs text-orange-600">Active Corridors</p>
              <Route className="h-4 w-4 text-orange-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-orange-700">
              {kpis.activeCorridors}
            </p>
            <TrendIndicator value={kpis.corridorsTrend} />
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/livestock/census"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-aris-primary-300 hover:bg-aris-primary-50"
        >
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-aris-primary-700">
              Census Data
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Population counts by country, species, and year
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-aris-primary-500" />
        </Link>
        <Link
          href="/livestock/production"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-aris-primary-300 hover:bg-aris-primary-50"
        >
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-aris-primary-700">
              Production
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Milk, meat, eggs, wool, hides, and honey output
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-aris-primary-500" />
        </Link>
        <Link
          href="/livestock/transhumance"
          className="group flex items-center justify-between rounded-card border border-gray-200 bg-white p-4 transition-colors hover:border-aris-primary-300 hover:bg-aris-primary-50"
        >
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-aris-primary-700">
              Transhumance
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Seasonal corridors and cross-border movements
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-aris-primary-500" />
        </Link>
      </div>

      {/* Recent Census Entries */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent Census Entries
          </h2>
          <Link
            href="/livestock/census"
            className="text-xs font-medium text-aris-primary-600 hover:text-aris-primary-700"
          >
            View all
          </Link>
        </div>

        {censusLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : censusError ? (
          <QueryError
            message={
              censusErr instanceof Error
                ? censusErr.message
                : 'Failed to load census data'
            }
            onRetry={() => refetchCensus()}
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Species</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Year</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Population</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {censusList.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{entry.country}</p>
                        <p className="text-xs text-gray-400">{entry.region}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{entry.species}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.year}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {entry.population.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{entry.source}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_BADGE[entry.status],
                          )}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {censusList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        No census data found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Campaigns & Alert */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DomainCampaignsSection domain="livestock" />
        <QuickAlertCard domain="livestock" alertFields={LIVESTOCK_ALERT_FIELDS} title="Report Livestock Issue" />
      </div>
    </div>
  );
}
