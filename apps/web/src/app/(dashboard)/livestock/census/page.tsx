'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLivestockCensus, type LivestockCensus } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-700',
  validated: 'bg-green-100 text-green-700',
  published: 'bg-gray-100 text-gray-600',
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
  {
    id: 'lc-6', country: 'Sudan', countryCode: 'SD', region: 'Kordofan',
    species: 'Camel', year: 2025, population: 4_800_000,
    femaleBreeding: 2_100_000, maleBreeding: 1_000_000, young: 1_700_000,
    source: 'National Census 2025', status: 'draft',
    createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-19T08:00:00Z',
  },
];

export default function LivestockCensusPage() {
  const t = useTranslations('livestock');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useLivestockCensus({
    page,
    limit,
    country: countryFilter || undefined,
    species: speciesFilter || undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
    search: search || undefined,
  });

  const censusList = data?.data ?? PLACEHOLDER_CENSUS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_CENSUS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/livestock"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('censusData')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('censusDataDesc')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchCensus')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allCountries')}</option>
            <option value="ET">Ethiopia</option>
            <option value="KE">Kenya</option>
            <option value="NG">Nigeria</option>
            <option value="TZ">Tanzania</option>
            <option value="ZA">South Africa</option>
            <option value="SD">Sudan</option>
          </select>
          <select
            value={speciesFilter}
            onChange={(e) => {
              setSpeciesFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allSpecies')}</option>
            <option value="Cattle">Cattle</option>
            <option value="Sheep">Sheep</option>
            <option value="Goat">Goat</option>
            <option value="Camel">Camel</option>
            <option value="Poultry">Poultry</option>
            <option value="Pig">Pig</option>
          </select>
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allYears')}</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={10} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load census data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('country')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Region</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('species')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('year')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('population')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Female Breeding</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Male Breeding</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Young</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('source')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {censusList.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{entry.country}</p>
                      <p className="text-xs text-gray-400">{entry.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.region}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.species}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.year}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {entry.population.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {entry.femaleBreeding.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {entry.maleBreeding.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {entry.young.toLocaleString()}
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
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      {t('noDataFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: censusList.length.toString(), total: meta.total.toString() })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
