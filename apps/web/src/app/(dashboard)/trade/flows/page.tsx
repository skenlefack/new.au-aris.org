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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useTradeFlows, type TradeFlow } from '@/lib/api/hooks';
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const DIRECTION_BADGE: Record<string, string> = {
  EXPORT: 'bg-green-100 text-green-700',
  IMPORT: 'bg-blue-100 text-blue-700',
  TRANSIT: 'bg-gray-100 text-gray-600',
};

const PLACEHOLDER_FLOWS: TradeFlow[] = [
  {
    id: 'tf-1', exportCountry: 'Kenya', exportCountryCode: 'KE',
    importCountry: 'Uganda', importCountryCode: 'UG',
    commodity: 'Live Cattle', hsCode: '0102.29',
    flowDirection: 'EXPORT', quantity: 12500, unit: 'heads',
    valueFob: 8_750_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Compliant',
    createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'tf-2', exportCountry: 'Ethiopia', exportCountryCode: 'ET',
    importCountry: 'Djibouti', importCountryCode: 'DJ',
    commodity: 'Chilled Beef', hsCode: '0201.30',
    flowDirection: 'EXPORT', quantity: 4200, unit: 'tonnes',
    valueFob: 14_280_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Compliant',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-02-17T16:00:00Z',
  },
  {
    id: 'tf-3', exportCountry: 'South Africa', exportCountryCode: 'ZA',
    importCountry: 'Nigeria', importCountryCode: 'NG',
    commodity: 'Poultry Meat (Frozen)', hsCode: '0207.14',
    flowDirection: 'EXPORT', quantity: 18000, unit: 'tonnes',
    valueFob: 27_000_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Under Review',
    createdAt: '2026-02-01T06:00:00Z', updatedAt: '2026-02-19T12:00:00Z',
  },
  {
    id: 'tf-4', exportCountry: 'Tanzania', exportCountryCode: 'TZ',
    importCountry: 'Kenya', importCountryCode: 'KE',
    commodity: 'Raw Hides', hsCode: '4101.20',
    flowDirection: 'EXPORT', quantity: 3800, unit: 'tonnes',
    valueFob: 5_700_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Compliant',
    createdAt: '2026-01-20T14:00:00Z', updatedAt: '2026-02-15T08:00:00Z',
  },
  {
    id: 'tf-5', exportCountry: 'Brazil', exportCountryCode: 'BR',
    importCountry: 'Egypt', importCountryCode: 'EG',
    commodity: 'Frozen Beef', hsCode: '0202.30',
    flowDirection: 'IMPORT', quantity: 25000, unit: 'tonnes',
    valueFob: 62_500_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Compliant',
    createdAt: '2026-01-05T09:00:00Z', updatedAt: '2026-02-10T10:00:00Z',
  },
  {
    id: 'tf-6', exportCountry: 'Senegal', exportCountryCode: 'SN',
    importCountry: 'Mali', importCountryCode: 'ML',
    commodity: 'Live Sheep', hsCode: '0104.10',
    flowDirection: 'TRANSIT', quantity: 8000, unit: 'heads',
    valueFob: 3_200_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Pending',
    createdAt: '2026-02-12T11:00:00Z', updatedAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'tf-7', exportCountry: 'Morocco', exportCountryCode: 'MA',
    importCountry: 'Mauritania', importCountryCode: 'MR',
    commodity: 'Dairy Products', hsCode: '0401.20',
    flowDirection: 'EXPORT', quantity: 6500, unit: 'tonnes',
    valueFob: 19_500_000, currency: 'USD',
    periodStart: '2026-01-01', periodEnd: '2026-03-31',
    spsStatus: 'Compliant',
    createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-02-14T15:00:00Z',
  },
];

// Derive top 5 commodities by value for the chart
function getTopCommodities(flows: TradeFlow[]) {
  const map = new Map<string, number>();
  for (const f of flows) {
    map.set(f.commodity, (map.get(f.commodity) ?? 0) + f.valueFob);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([commodity, value]) => ({ commodity, value }));
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function TradeFlowsPage() {
  const t = useTranslations('trade');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useTradeFlows({
    page,
    limit,
    flowDirection: directionFilter || undefined,
    commodity: commodityFilter || undefined,
    search: search || undefined,
  });

  const flows = data?.data ?? PLACEHOLDER_FLOWS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_FLOWS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);
  const topCommodities = getTopCommodities(flows);

  // Unique commodities for filter dropdown
  const commodities = Array.from(new Set(PLACEHOLDER_FLOWS.map((f) => f.commodity)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/trade"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tradeFlows')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('tradeFlowsDesc')}
          </p>
        </div>
      </div>

      {/* Top Commodities Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Top 5 Commodities by Trade Value
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Based on current filtered trade flow records
        </p>
        {isLoading ? (
          <Skeleton className="mt-4 h-48 w-full" />
        ) : (
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCommodities}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => formatUsd(v)}
                />
                <YAxis
                  type="category"
                  dataKey="commodity"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  width={140}
                />
                <Tooltip
                  formatter={(value: number) => [formatUsd(value), 'Value (FOB)']}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#1B5E20"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchFlows')}
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
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allStatus')}</option>
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
            <option value="TRANSIT">Transit</option>
          </select>
          <select
            value={commodityFilter}
            onChange={(e) => {
              setCommodityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allProducts')}</option>
            {commodities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={7} cols={10} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load trade flows'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('exporter')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('importer')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('commodity')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">HS Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('quantity')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('valueUsd')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Currency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Period</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {flows.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      {f.exportCountry}
                      <p className="text-xs text-gray-400">{f.exportCountryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {f.importCountry}
                      <p className="text-xs text-gray-400">{f.importCountryCode}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{f.commodity}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.hsCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          DIRECTION_BADGE[f.flowDirection],
                        )}
                      >
                        {f.flowDirection}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {f.quantity.toLocaleString()}
                      <span className="ml-1 text-xs text-gray-400">{f.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatUsd(f.valueFob)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{f.currency}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(f.periodStart).toLocaleDateString()} —{' '}
                      {new Date(f.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{f.spsStatus}</td>
                  </tr>
                ))}
                {flows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      {t('noFlowsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: String(flows.length), total: String(meta.total) })}
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
