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
import { useTranslations } from '@/lib/i18n/translations';
import { useFisheriesAquaculture, type AquacultureFarm } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  under_construction: 'bg-blue-100 text-blue-700',
};

const FARM_TYPE_BADGE: Record<string, string> = {
  pond: 'bg-teal-100 text-teal-700',
  cage: 'bg-blue-100 text-blue-700',
  raceway: 'bg-indigo-100 text-indigo-700',
  recirculating: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

const PLACEHOLDER_FARMS: AquacultureFarm[] = [
  {
    id: 'af-1',
    name: 'Lake Volta Tilapia Farm',
    country: 'Ghana',
    countryCode: 'GH',
    species: 'Oreochromis niloticus',
    farmType: 'cage',
    productionTonnes: 3_200,
    areaHectares: 45,
    status: 'active',
    createdAt: '2022-06-15T10:00:00Z',
    updatedAt: '2026-01-20T08:00:00Z',
  },
  {
    id: 'af-2',
    name: 'Kafue Floodplain Ponds',
    country: 'Zambia',
    countryCode: 'ZM',
    species: 'Oreochromis andersonii',
    farmType: 'pond',
    productionTonnes: 850,
    areaHectares: 120,
    status: 'active',
    createdAt: '2020-03-10T09:00:00Z',
    updatedAt: '2025-12-05T14:00:00Z',
  },
  {
    id: 'af-3',
    name: 'Sharm Aquaculture Centre',
    country: 'Egypt',
    countryCode: 'EG',
    species: 'Dicentrarchus labrax',
    farmType: 'raceway',
    productionTonnes: 5_400,
    areaHectares: 30,
    status: 'active',
    createdAt: '2019-11-22T07:00:00Z',
    updatedAt: '2026-02-10T11:00:00Z',
  },
  {
    id: 'af-4',
    name: 'Kigali Recirculation Facility',
    country: 'Rwanda',
    countryCode: 'RW',
    species: 'Clarias gariepinus',
    farmType: 'recirculating',
    productionTonnes: 420,
    areaHectares: 2.5,
    status: 'active',
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'af-5',
    name: 'Mwanza Bay Expansion',
    country: 'Tanzania',
    countryCode: 'TZ',
    species: 'Oreochromis niloticus',
    farmType: 'cage',
    productionTonnes: 0,
    areaHectares: 60,
    status: 'under_construction',
    createdAt: '2025-09-15T08:00:00Z',
    updatedAt: '2026-02-18T16:00:00Z',
  },
  {
    id: 'af-6',
    name: 'Oshakati Fish Farm',
    country: 'Namibia',
    countryCode: 'NA',
    species: 'Oreochromis mossambicus',
    farmType: 'pond',
    productionTonnes: 180,
    areaHectares: 35,
    status: 'inactive',
    createdAt: '2018-04-20T11:00:00Z',
    updatedAt: '2025-06-30T10:00:00Z',
  },
];

export default function AquaculturePage() {
  const t = useTranslations('fisheries');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [farmTypeFilter, setFarmTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useFisheriesAquaculture({
    page,
    limit,
    country: countryFilter || undefined,
    farmType: farmTypeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const farms = data?.data ?? PLACEHOLDER_FARMS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_FARMS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  // Summary computations
  const activeFarms = farms.filter((f) => f.status === 'active');
  const totalProduction = activeFarms.reduce((sum, f) => sum + f.productionTonnes, 0);
  const totalArea = farms.reduce((sum, f) => sum + f.areaHectares, 0);
  const avgArea = farms.length > 0 ? totalArea / farms.length : 0;

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
          <h1 className="text-2xl font-bold text-gray-900">
            {t('aquaTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('aquaSubtitle')}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-600">{t('activeFarms')}</p>
          <p className="text-xl font-bold text-green-700">
            {activeFarms.length}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">Total Production</p>
          <p className="text-xl font-bold text-gray-900">
            {totalProduction.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-gray-400">
              tonnes
            </span>
          </p>
        </div>
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-4">
          <p className="text-xs text-aris-primary-600">Average Area</p>
          <p className="text-xl font-bold text-aris-primary-700">
            {avgArea.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-aris-primary-400">
              ha
            </span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchFarms')}
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
            <option value="GH">Ghana</option>
            <option value="ZM">Zambia</option>
            <option value="EG">Egypt</option>
            <option value="RW">Rwanda</option>
            <option value="TZ">Tanzania</option>
            <option value="NA">Namibia</option>
          </select>
          <select
            value={farmTypeFilter}
            onChange={(e) => {
              setFarmTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allFarmTypes')}</option>
            <option value="pond">{t('pond')}</option>
            <option value="cage">{t('cage')}</option>
            <option value="raceway">{t('raceway')}</option>
            <option value="recirculating">{t('recirculating')}</option>
            <option value="other">{t('other')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allStatus')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
            <option value="under_construction">{t('underConstruction')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load farms'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('farmName')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('farmCountry')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('farmSpecies')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('farmType')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('prodTonnes')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('areaHa')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('farmStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {farms.map((farm) => (
                  <tr key={farm.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{farm.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{farm.country}</p>
                      <p className="text-xs text-gray-400">{farm.countryCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 italic">{farm.species}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          FARM_TYPE_BADGE[farm.farmType],
                        )}
                      >
                        {farm.farmType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {farm.productionTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {farm.areaHectares.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_BADGE[farm.status],
                        )}
                      >
                        {farm.status === 'under_construction'
                          ? t('underConstruction')
                          : farm.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                  </tr>
                ))}
                {farms.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      {t('noFarmsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: String(farms.length), total: String(meta.total) })}
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
