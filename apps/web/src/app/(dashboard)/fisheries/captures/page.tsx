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
import { useFisheriesCaptures, type CaptureRecord } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PLACEHOLDER_CAPTURES: CaptureRecord[] = [
  {
    id: 'cap-1',
    country: 'Morocco',
    countryCode: 'MA',
    species: 'Sardina pilchardus',
    faoArea: '34 — Eastern Central Atlantic',
    catchMethod: 'Purse seine',
    quantity: 785_000,
    unit: 'tonnes',
    year: 2025,
    quarter: 4,
    landingSite: 'Laayoune',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'cap-2',
    country: 'Nigeria',
    countryCode: 'NG',
    species: 'Ethmalosa fimbriata',
    faoArea: '34 — Eastern Central Atlantic',
    catchMethod: 'Gillnet',
    quantity: 124_500,
    unit: 'tonnes',
    year: 2025,
    quarter: 3,
    landingSite: 'Lagos',
    createdAt: '2025-11-20T09:00:00Z',
    updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'cap-3',
    country: 'Uganda',
    countryCode: 'UG',
    species: 'Lates niloticus',
    faoArea: '01 — Africa, Inland waters',
    catchMethod: 'Longline',
    quantity: 98_300,
    unit: 'tonnes',
    year: 2025,
    quarter: 4,
    landingSite: 'Entebbe',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'cap-4',
    country: 'Senegal',
    countryCode: 'SN',
    species: 'Sardinella aurita',
    faoArea: '34 — Eastern Central Atlantic',
    catchMethod: 'Purse seine',
    quantity: 215_000,
    unit: 'tonnes',
    year: 2025,
    quarter: 2,
    landingSite: 'Dakar',
    createdAt: '2025-08-12T11:00:00Z',
    updatedAt: '2025-10-22T16:00:00Z',
  },
  {
    id: 'cap-5',
    country: 'Tanzania',
    countryCode: 'TZ',
    species: 'Rastrineobola argentea',
    faoArea: '01 — Africa, Inland waters',
    catchMethod: 'Beach seine',
    quantity: 56_700,
    unit: 'tonnes',
    year: 2026,
    quarter: 1,
    landingSite: 'Mwanza',
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'cap-6',
    country: 'South Africa',
    countryCode: 'ZA',
    species: 'Merluccius capensis',
    faoArea: '47 — Southeast Atlantic',
    catchMethod: 'Bottom trawl',
    quantity: 142_000,
    unit: 'tonnes',
    year: 2025,
    quarter: 4,
    landingSite: 'Cape Town',
    createdAt: '2026-01-08T07:00:00Z',
    updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'cap-7',
    country: 'Mozambique',
    countryCode: 'MZ',
    species: 'Penaeus indicus',
    faoArea: '51 — Western Indian Ocean',
    catchMethod: 'Trawl',
    quantity: 12_400,
    unit: 'tonnes',
    year: 2025,
    quarter: 3,
    landingSite: 'Maputo',
    createdAt: '2025-10-20T09:00:00Z',
    updatedAt: '2025-12-15T14:00:00Z',
  },
];

export default function CapturesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [catchMethodFilter, setCatchMethodFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useFisheriesCaptures({
    page,
    limit,
    species: speciesFilter || undefined,
    catchMethod: catchMethodFilter || undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
    search: search || undefined,
  });

  const captures = data?.data ?? PLACEHOLDER_CAPTURES;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_CAPTURES.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/fisheries"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Captures</h1>
          <p className="mt-1 text-sm text-gray-500">
            Marine and inland capture records across Africa
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search captures..."
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
            value={speciesFilter}
            onChange={(e) => {
              setSpeciesFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Species</option>
            <option value="Sardina pilchardus">Sardina pilchardus</option>
            <option value="Ethmalosa fimbriata">Ethmalosa fimbriata</option>
            <option value="Lates niloticus">Lates niloticus</option>
            <option value="Sardinella aurita">Sardinella aurita</option>
            <option value="Merluccius capensis">Merluccius capensis</option>
            <option value="Penaeus indicus">Penaeus indicus</option>
          </select>
          <select
            value={catchMethodFilter}
            onChange={(e) => {
              setCatchMethodFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Methods</option>
            <option value="Purse seine">Purse seine</option>
            <option value="Gillnet">Gillnet</option>
            <option value="Longline">Longline</option>
            <option value="Beach seine">Beach seine</option>
            <option value="Bottom trawl">Bottom trawl</option>
            <option value="Trawl">Trawl</option>
          </select>
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={7} cols={9} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load captures'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Species</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">FAO Area</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Catch Method</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Unit</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Year</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Quarter</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Landing Site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {captures.map((cap) => (
                  <tr key={cap.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{cap.country}</p>
                      <p className="text-xs text-gray-400">{cap.countryCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 italic">{cap.species}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p className="max-w-[180px] truncate">{cap.faoArea}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{cap.catchMethod}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {cap.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{cap.unit}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{cap.year}</td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {cap.quarter ? `Q${cap.quarter}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{cap.landingSite}</td>
                  </tr>
                ))}
                {captures.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      No capture records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {captures.length} of {meta.total} records
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
