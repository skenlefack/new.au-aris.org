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
import { useWildlifeInventory, type WildlifeInventory } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const IUCN_BADGE: Record<string, string> = {
  LC: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  NT: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  VU: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  EN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  EX: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const IUCN_LABELS: Record<string, string> = {
  LC: 'Least Concern',
  NT: 'Near Threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically Endangered',
  EW: 'Extinct in Wild',
  EX: 'Extinct',
};

const TREND_BADGE: Record<string, string> = {
  increasing: 'text-green-600 dark:text-green-400',
  stable: 'text-gray-500 dark:text-gray-400',
  decreasing: 'text-red-600 dark:text-red-400',
  unknown: 'text-gray-400 dark:text-gray-500',
};

const PLACEHOLDER_INVENTORY: WildlifeInventory[] = [
  {
    id: 'wi-1', species: 'Loxodonta africana', commonName: 'African Elephant',
    taxonomicClass: 'Mammals', iucnStatus: 'EN', country: 'Kenya', countryCode: 'KE',
    protectedArea: 'Amboseli NP', estimatedPopulation: 1_800, surveyYear: 2025,
    trend: 'stable', source: 'KWS Aerial Census',
    createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'wi-2', species: 'Panthera leo', commonName: 'African Lion',
    taxonomicClass: 'Mammals', iucnStatus: 'VU', country: 'Tanzania', countryCode: 'TZ',
    protectedArea: 'Serengeti NP', estimatedPopulation: 3_200, surveyYear: 2025,
    trend: 'decreasing', source: 'TAWIRI Survey',
    createdAt: '2025-11-20T09:00:00Z', updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'wi-3', species: 'Gorilla beringei', commonName: 'Mountain Gorilla',
    taxonomicClass: 'Mammals', iucnStatus: 'EN', country: 'Rwanda', countryCode: 'RW',
    protectedArea: 'Volcanoes NP', estimatedPopulation: 604, surveyYear: 2025,
    trend: 'increasing', source: 'IGCP Census',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'wi-4', species: 'Diceros bicornis', commonName: 'Black Rhinoceros',
    taxonomicClass: 'Mammals', iucnStatus: 'CR', country: 'South Africa', countryCode: 'ZA',
    protectedArea: 'Kruger NP', estimatedPopulation: 2_056, surveyYear: 2025,
    trend: 'stable', source: 'SANParks Survey',
    createdAt: '2025-08-12T11:00:00Z', updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'wi-5', species: 'Giraffa camelopardalis', commonName: 'Giraffe',
    taxonomicClass: 'Mammals', iucnStatus: 'VU', country: 'Niger', countryCode: 'NE',
    protectedArea: 'W National Park', estimatedPopulation: 600, surveyYear: 2024,
    trend: 'increasing', source: 'IUCN SSC Survey',
    createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'wi-6', species: 'Psittacus erithacus', commonName: 'African Grey Parrot',
    taxonomicClass: 'Birds', iucnStatus: 'EN', country: 'Cameroon', countryCode: 'CM',
    protectedArea: 'Korup NP', estimatedPopulation: 12_500, surveyYear: 2025,
    trend: 'decreasing', source: 'BirdLife Survey',
    createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'wi-7', species: 'Crocodylus niloticus', commonName: 'Nile Crocodile',
    taxonomicClass: 'Reptiles', iucnStatus: 'LC', country: 'Uganda', countryCode: 'UG',
    protectedArea: 'Murchison Falls NP', estimatedPopulation: 5_400, surveyYear: 2025,
    trend: 'stable', source: 'UWA Census',
    createdAt: '2025-10-20T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z',
  },
];

export default function SpeciesInventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [iucnFilter, setIucnFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useWildlifeInventory({
    page,
    limit,
    taxonomicClass: classFilter || undefined,
    iucnStatus: iucnFilter || undefined,
    search: search || undefined,
  });

  const inventory = data?.data ?? PLACEHOLDER_INVENTORY;
  const meta = data?.meta ?? { total: PLACEHOLDER_INVENTORY.length, page: 1, limit: 10 };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/wildlife"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Species Inventory</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Continental species records, population estimates, and IUCN conservation status
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search species..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Classes</option>
            <option value="Mammals">Mammals</option>
            <option value="Birds">Birds</option>
            <option value="Reptiles">Reptiles</option>
            <option value="Amphibians">Amphibians</option>
            <option value="Fish">Fish</option>
          </select>
          <select
            value={iucnFilter}
            onChange={(e) => { setIucnFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All IUCN Status</option>
            <option value="CR">Critically Endangered</option>
            <option value="EN">Endangered</option>
            <option value="VU">Vulnerable</option>
            <option value="NT">Near Threatened</option>
            <option value="LC">Least Concern</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={7} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load inventory'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Species</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Class</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">IUCN</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Protected Area</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Population</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Trend</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.commonName}</p>
                      <p className="text-xs italic text-gray-400">{item.species}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.taxonomicClass}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', IUCN_BADGE[item.iucnStatus])}>
                        {item.iucnStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{item.country}</p>
                      <p className="text-xs text-gray-400">{item.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.protectedArea}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {item.estimatedPopulation.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs font-medium capitalize', TREND_BADGE[item.trend])}>
                        {item.trend === 'increasing' ? '↑' : item.trend === 'decreasing' ? '↓' : '—'} {item.trend}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{item.surveyYear}</td>
                  </tr>
                ))}
                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No species records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {inventory.length} of {meta.total} records
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
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
