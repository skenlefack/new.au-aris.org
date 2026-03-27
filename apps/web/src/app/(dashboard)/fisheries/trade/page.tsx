'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFishTrade, type TradeFlow } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PLACEHOLDER_TRADES: TradeFlow[] = [
  {
    id: 'ft-1',
    exportCountry: 'Morocco',
    exportCountryCode: 'MA',
    importCountry: 'Spain',
    importCountryCode: 'ES',
    commodity: 'Sardina pilchardus (frozen)',
    hsCode: '030354',
    flowDirection: 'EXPORT',
    quantity: 125_000,
    unit: 'tonnes',
    valueFob: 187_500_000,
    currency: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    spsStatus: 'COMPLIANT',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'ft-2',
    exportCountry: 'Senegal',
    exportCountryCode: 'SN',
    importCountry: 'Nigeria',
    importCountryCode: 'NG',
    commodity: 'Sardinella aurita (dried)',
    hsCode: '030559',
    flowDirection: 'EXPORT',
    quantity: 42_000,
    unit: 'tonnes',
    valueFob: 31_500_000,
    currency: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    spsStatus: 'COMPLIANT',
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-02-01T14:00:00Z',
  },
  {
    id: 'ft-3',
    exportCountry: 'China',
    exportCountryCode: 'CN',
    importCountry: 'Nigeria',
    importCountryCode: 'NG',
    commodity: 'Mackerel (frozen)',
    hsCode: '030354',
    flowDirection: 'IMPORT',
    quantity: 280_000,
    unit: 'tonnes',
    valueFob: 210_000_000,
    currency: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    spsStatus: 'COMPLIANT',
    createdAt: '2026-01-08T07:00:00Z',
    updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'ft-4',
    exportCountry: 'Uganda',
    exportCountryCode: 'UG',
    importCountry: 'Democratic Republic of Congo',
    importCountryCode: 'CD',
    commodity: 'Lates niloticus (fresh)',
    hsCode: '030214',
    flowDirection: 'EXPORT',
    quantity: 18_500,
    unit: 'tonnes',
    valueFob: 27_750_000,
    currency: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    spsStatus: 'COMPLIANT',
    createdAt: '2025-12-20T10:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'ft-5',
    exportCountry: 'South Africa',
    exportCountryCode: 'ZA',
    importCountry: 'Japan',
    importCountryCode: 'JP',
    commodity: 'Merluccius capensis (filleted)',
    hsCode: '030489',
    flowDirection: 'EXPORT',
    quantity: 35_000,
    unit: 'tonnes',
    valueFob: 105_000_000,
    currency: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    spsStatus: 'COMPLIANT',
    createdAt: '2026-01-12T08:00:00Z',
    updatedAt: '2026-02-05T12:00:00Z',
  },
];

const PLACEHOLDER_KPIS = {
  totalExports: 456_750_000,
  totalImports: 310_000_000,
  tradeBalance: 146_750_000,
};

export default function FishTradePage() {
  const t = useTranslations('fisheries');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [productStateFilter, setProductStateFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useFishTrade({
    page,
    limit,
    country: countryFilter || undefined,
    productState: productStateFilter || undefined,
    flowDirection: directionFilter || undefined,
    search: search || undefined,
  });

  const trades = data?.data?.length ? data.data : PLACEHOLDER_TRADES;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_TRADES.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  // Calculate KPIs from data or use placeholders
  const kpis = PLACEHOLDER_KPIS;

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
          <h1 className="text-2xl font-bold text-gray-900">{t('fishTrade')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('fishTradeDesc')}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('totalExports')}
            </p>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            ${(kpis.totalExports / 1_000_000).toFixed(1)}M
          </p>
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('totalImports')}
            </p>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            ${(kpis.totalImports / 1_000_000).toFixed(1)}M
          </p>
        </div>

        <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('tradeBalance')}
            </p>
            <ArrowUpDown className="h-5 w-5 text-teal-600" />
          </div>
          <p className={cn(
            'mt-2 text-2xl font-bold',
            kpis.tradeBalance >= 0 ? 'text-green-700' : 'text-red-700',
          )}>
            {kpis.tradeBalance >= 0 ? '+' : ''}${(kpis.tradeBalance / 1_000_000).toFixed(1)}M
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchTrade')}
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
            <option value="MA">Morocco</option>
            <option value="SN">Senegal</option>
            <option value="NG">Nigeria</option>
            <option value="UG">Uganda</option>
            <option value="ZA">South Africa</option>
          </select>
          <select
            value={productStateFilter}
            onChange={(e) => {
              setProductStateFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allProductStates')}</option>
            <option value="fresh">{t('fresh')}</option>
            <option value="frozen">{t('frozen')}</option>
            <option value="dried">{t('dried')}</option>
            <option value="smoked">{t('smoked')}</option>
            <option value="canned">{t('canned')}</option>
            <option value="salted">{t('salted')}</option>
            <option value="filleted">{t('filleted')}</option>
            <option value="live">{t('live')}</option>
          </select>
          <select
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allDirections')}</option>
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load trade data'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('exporter') || 'Exporter'}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('importer') || 'Importer'}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('species')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('productState')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('quantity')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('value')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('period')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trades.map((flow) => {
                  // Extract product state from commodity name
                  const productStateMatch = flow.commodity.match(/\(([^)]+)\)/);
                  const productState = productStateMatch?.[1] ?? '-';
                  const speciesName = flow.commodity.replace(/\s*\([^)]*\)/, '');

                  return (
                    <tr key={flow.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{flow.exportCountry}</p>
                        <p className="text-xs text-gray-400">{flow.exportCountryCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{flow.importCountry}</p>
                        <p className="text-xs text-gray-400">{flow.importCountryCode}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 italic">{speciesName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {productState}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {flow.quantity.toLocaleString()} {flow.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        ${flow.valueFob.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        {flow.periodStart} &mdash; {flow.periodEnd}
                      </td>
                    </tr>
                  );
                })}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      {t('noTradeFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: String(trades.length), total: String(meta.total) })}
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
