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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useMarketPrices, type MarketPrice } from '@/lib/api/hooks';
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PRICE_TYPE_BADGE: Record<string, string> = {
  WHOLESALE: 'bg-blue-100 text-blue-700',
  RETAIL: 'bg-purple-100 text-purple-700',
  FARM_GATE: 'bg-green-100 text-green-700',
  EXPORT: 'bg-orange-100 text-orange-700',
};

interface PriceTrendPoint {
  month: string;
  price: number;
}

const PLACEHOLDER_PRICES: MarketPrice[] = [
  {
    id: 'mp-1', market: 'Nairobi Livestock Market', country: 'Kenya', countryCode: 'KE',
    commodity: 'Live Cattle', species: 'Cattle',
    priceType: 'WHOLESALE', price: 850, currency: 'USD', unit: 'head',
    date: '2026-02-15', source: 'Kenya Livestock Marketing Council',
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'mp-2', market: 'Addis Ababa Central', country: 'Ethiopia', countryCode: 'ET',
    commodity: 'Live Sheep', species: 'Sheep',
    priceType: 'RETAIL', price: 120, currency: 'USD', unit: 'head',
    date: '2026-02-14', source: 'Ethiopian Meat & Dairy Industry Development Institute',
    createdAt: '2026-02-14T08:00:00Z', updatedAt: '2026-02-14T08:00:00Z',
  },
  {
    id: 'mp-3', market: 'Lagos Commodity Exchange', country: 'Nigeria', countryCode: 'NG',
    commodity: 'Poultry Meat', species: 'Poultry',
    priceType: 'WHOLESALE', price: 2.45, currency: 'USD', unit: 'kg',
    date: '2026-02-16', source: 'Nigeria Poultry Association',
    createdAt: '2026-02-16T06:00:00Z', updatedAt: '2026-02-16T06:00:00Z',
  },
  {
    id: 'mp-4', market: 'Dakar Fish Market', country: 'Senegal', countryCode: 'SN',
    commodity: 'Fresh Fish (Tilapia)', species: 'Tilapia',
    priceType: 'RETAIL', price: 3.80, currency: 'USD', unit: 'kg',
    date: '2026-02-13', source: 'Senegalese Fisheries Ministry',
    createdAt: '2026-02-13T14:00:00Z', updatedAt: '2026-02-13T14:00:00Z',
  },
  {
    id: 'mp-5', market: 'Cairo Wholesale Market', country: 'Egypt', countryCode: 'EG',
    commodity: 'Raw Milk', species: 'Cattle',
    priceType: 'FARM_GATE', price: 0.62, currency: 'USD', unit: 'litre',
    date: '2026-02-12', source: 'Egyptian Dairy Board',
    createdAt: '2026-02-12T12:00:00Z', updatedAt: '2026-02-12T12:00:00Z',
  },
  {
    id: 'mp-6', market: 'Mombasa Export Terminal', country: 'Kenya', countryCode: 'KE',
    commodity: 'Chilled Beef', species: 'Cattle',
    priceType: 'EXPORT', price: 5.20, currency: 'USD', unit: 'kg',
    date: '2026-02-17', source: 'Kenya Meat Commission',
    createdAt: '2026-02-17T09:00:00Z', updatedAt: '2026-02-17T09:00:00Z',
  },
  {
    id: 'mp-7', market: 'Accra Central Market', country: 'Ghana', countryCode: 'GH',
    commodity: 'Live Goats', species: 'Goat',
    priceType: 'RETAIL', price: 95, currency: 'USD', unit: 'head',
    date: '2026-02-11', source: 'Ghana Statistical Service',
    createdAt: '2026-02-11T11:00:00Z', updatedAt: '2026-02-11T11:00:00Z',
  },
  {
    id: 'mp-8', market: 'Dar es Salaam Wholesale', country: 'Tanzania', countryCode: 'TZ',
    commodity: 'Honey', species: 'Bees',
    priceType: 'WHOLESALE', price: 8.50, currency: 'USD', unit: 'kg',
    date: '2026-02-10', source: 'Tanzania Honey Council',
    createdAt: '2026-02-10T07:00:00Z', updatedAt: '2026-02-10T07:00:00Z',
  },
];

const PLACEHOLDER_TRENDS: Record<string, PriceTrendPoint[]> = {
  'Live Cattle': [
    { month: 'Sep 2025', price: 780 },
    { month: 'Oct 2025', price: 795 },
    { month: 'Nov 2025', price: 810 },
    { month: 'Dec 2025', price: 830 },
    { month: 'Jan 2026', price: 840 },
    { month: 'Feb 2026', price: 850 },
  ],
  'Live Sheep': [
    { month: 'Sep 2025', price: 95 },
    { month: 'Oct 2025', price: 100 },
    { month: 'Nov 2025', price: 105 },
    { month: 'Dec 2025', price: 115 },
    { month: 'Jan 2026', price: 118 },
    { month: 'Feb 2026', price: 120 },
  ],
  'Poultry Meat': [
    { month: 'Sep 2025', price: 2.10 },
    { month: 'Oct 2025', price: 2.18 },
    { month: 'Nov 2025', price: 2.25 },
    { month: 'Dec 2025', price: 2.35 },
    { month: 'Jan 2026', price: 2.40 },
    { month: 'Feb 2026', price: 2.45 },
  ],
  'Fresh Fish (Tilapia)': [
    { month: 'Sep 2025', price: 3.20 },
    { month: 'Oct 2025', price: 3.35 },
    { month: 'Nov 2025', price: 3.50 },
    { month: 'Dec 2025', price: 3.60 },
    { month: 'Jan 2026', price: 3.70 },
    { month: 'Feb 2026', price: 3.80 },
  ],
  'Raw Milk': [
    { month: 'Sep 2025', price: 0.55 },
    { month: 'Oct 2025', price: 0.56 },
    { month: 'Nov 2025', price: 0.58 },
    { month: 'Dec 2025', price: 0.59 },
    { month: 'Jan 2026', price: 0.61 },
    { month: 'Feb 2026', price: 0.62 },
  ],
  'Chilled Beef': [
    { month: 'Sep 2025', price: 4.60 },
    { month: 'Oct 2025', price: 4.70 },
    { month: 'Nov 2025', price: 4.85 },
    { month: 'Dec 2025', price: 4.95 },
    { month: 'Jan 2026', price: 5.10 },
    { month: 'Feb 2026', price: 5.20 },
  ],
  'Live Goats': [
    { month: 'Sep 2025', price: 78 },
    { month: 'Oct 2025', price: 80 },
    { month: 'Nov 2025', price: 84 },
    { month: 'Dec 2025', price: 88 },
    { month: 'Jan 2026', price: 92 },
    { month: 'Feb 2026', price: 95 },
  ],
  'Honey': [
    { month: 'Sep 2025', price: 7.50 },
    { month: 'Oct 2025', price: 7.70 },
    { month: 'Nov 2025', price: 7.90 },
    { month: 'Dec 2025', price: 8.10 },
    { month: 'Jan 2026', price: 8.30 },
    { month: 'Feb 2026', price: 8.50 },
  ],
};

// Get unique commodities
const ALL_COMMODITIES = Array.from(new Set(PLACEHOLDER_PRICES.map((p) => p.commodity)));

export default function MarketPricesPage() {
  const t = useTranslations('trade');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [priceTypeFilter, setPriceTypeFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [trendCommodity, setTrendCommodity] = useState(ALL_COMMODITIES[0]);
  const limit = 10;

  const { data, isLoading, isError, error, refetch } = useMarketPrices({
    page,
    limit,
    commodity: commodityFilter || undefined,
    priceType: priceTypeFilter || undefined,
    country: countryFilter || undefined,
    search: search || undefined,
  });

  const prices = data?.data ?? PLACEHOLDER_PRICES;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_PRICES.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  const trendData = PLACEHOLDER_TRENDS[trendCommodity] ?? [];

  // Unique countries for filter
  const countries = Array.from(new Set(PLACEHOLDER_PRICES.map((p) => p.country)));

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
          <h1 className="text-2xl font-bold text-gray-900">{t('markets')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('marketsDesc')}
          </p>
        </div>
      </div>

      {/* Price Trend Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Price Trend
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              6-month average price trend for selected commodity
            </p>
          </div>
          <select
            value={trendCommodity}
            onChange={(e) => setTrendCommodity(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            {ALL_COMMODITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value}`, 'Price']}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#1B5E20"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#1B5E20', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#1B5E20' }}
                  name={trendCommodity}
                />
              </LineChart>
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
            placeholder={t('searchMarkets')}
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
            value={commodityFilter}
            onChange={(e) => {
              setCommodityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allProducts')}</option>
            {ALL_COMMODITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={priceTypeFilter}
            onChange={(e) => {
              setPriceTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allStatus')}</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="RETAIL">Retail</option>
            <option value="FARM_GATE">Farm Gate</option>
            <option value="EXPORT">Export</option>
          </select>
          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allCountries')}</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={10} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load market prices'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('marketName')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('location')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('commodity')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Species</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('priceUsd')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Currency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('priceUnit')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('lastUpdated')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prices.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.market}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.country}
                      <p className="text-xs text-gray-400">{p.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{p.commodity}</td>
                    <td className="px-4 py-3 text-gray-700">{p.species}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          PRICE_TYPE_BADGE[p.priceType],
                        )}
                      >
                        {p.priceType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {p.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.currency}</td>
                    <td className="px-4 py-3 text-gray-500">/{p.unit}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-400">
                      {p.source}
                    </td>
                  </tr>
                ))}
                {prices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      {t('noMarketsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: String(prices.length), total: String(meta.total) })}
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
