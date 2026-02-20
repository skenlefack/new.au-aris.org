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
import { useFisheriesVessels, type Vessel } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const LICENSE_BADGE: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-amber-100 text-amber-700',
  pending: 'bg-blue-100 text-blue-700',
};

const PLACEHOLDER_VESSELS: Vessel[] = [
  {
    id: 'vs-1',
    name: 'Atlantic Star',
    registrationNumber: 'MA-FSH-2021-0042',
    flag: 'Morocco',
    flagCode: 'MA',
    vesselType: 'Trawler',
    lengthMeters: 34.5,
    tonnage: 280,
    licenseStatus: 'valid',
    homePort: 'Agadir',
    createdAt: '2021-03-15T10:00:00Z',
    updatedAt: '2026-01-20T08:00:00Z',
  },
  {
    id: 'vs-2',
    name: 'Dakar Queen',
    registrationNumber: 'SN-FSH-2019-0118',
    flag: 'Senegal',
    flagCode: 'SN',
    vesselType: 'Purse seiner',
    lengthMeters: 28.2,
    tonnage: 195,
    licenseStatus: 'valid',
    homePort: 'Dakar',
    createdAt: '2019-07-22T09:00:00Z',
    updatedAt: '2025-12-10T14:00:00Z',
  },
  {
    id: 'vs-3',
    name: 'Cape Fisher',
    registrationNumber: 'ZA-FSH-2020-0256',
    flag: 'South Africa',
    flagCode: 'ZA',
    vesselType: 'Longliner',
    lengthMeters: 42.0,
    tonnage: 385,
    licenseStatus: 'expired',
    homePort: 'Cape Town',
    createdAt: '2020-01-10T07:00:00Z',
    updatedAt: '2025-11-30T16:00:00Z',
  },
  {
    id: 'vs-4',
    name: 'Nile Harvest',
    registrationNumber: 'UG-FSH-2023-0034',
    flag: 'Uganda',
    flagCode: 'UG',
    vesselType: 'Gillnetter',
    lengthMeters: 12.5,
    tonnage: 25,
    licenseStatus: 'valid',
    homePort: 'Entebbe',
    createdAt: '2023-05-08T10:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'vs-5',
    name: 'Mombasa Pride',
    registrationNumber: 'KE-FSH-2022-0087',
    flag: 'Kenya',
    flagCode: 'KE',
    vesselType: 'Trawler',
    lengthMeters: 22.8,
    tonnage: 150,
    licenseStatus: 'suspended',
    homePort: 'Mombasa',
    createdAt: '2022-09-18T11:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'vs-6',
    name: 'Lagos Breeze',
    registrationNumber: 'NG-FSH-2024-0015',
    flag: 'Nigeria',
    flagCode: 'NG',
    vesselType: 'Purse seiner',
    lengthMeters: 18.3,
    tonnage: 85,
    licenseStatus: 'pending',
    homePort: 'Lagos',
    createdAt: '2024-11-20T08:00:00Z',
    updatedAt: '2026-02-12T14:00:00Z',
  },
];

export default function VesselsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vesselTypeFilter, setVesselTypeFilter] = useState('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useFisheriesVessels({
    page,
    limit,
    vesselType: vesselTypeFilter || undefined,
    licenseStatus: licenseStatusFilter || undefined,
    search: search || undefined,
  });

  const vessels = data?.data ?? PLACEHOLDER_VESSELS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_VESSELS.length,
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
          <h1 className="text-2xl font-bold text-gray-900">Vessel Registry</h1>
          <p className="mt-1 text-sm text-gray-500">
            Registered fishing vessels and license status
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search vessels..."
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
            value={vesselTypeFilter}
            onChange={(e) => {
              setVesselTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="Trawler">Trawler</option>
            <option value="Purse seiner">Purse seiner</option>
            <option value="Longliner">Longliner</option>
            <option value="Gillnetter">Gillnetter</option>
          </select>
          <select
            value={licenseStatusFilter}
            onChange={(e) => {
              setLicenseStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All License Status</option>
            <option value="valid">Valid</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load vessels'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Registration #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Flag</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Length (m)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Tonnage (GT)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">License Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Home Port</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vessels.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{v.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-700">
                        {v.registrationNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{v.flag}</p>
                      <p className="text-xs text-gray-400">{v.flagCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{v.vesselType}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {v.lengthMeters.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {v.tonnage.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          LICENSE_BADGE[v.licenseStatus],
                        )}
                      >
                        {v.licenseStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{v.homePort}</td>
                  </tr>
                ))}
                {vessels.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No vessels found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {vessels.length} of {meta.total} vessels
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
