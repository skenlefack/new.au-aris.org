'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
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
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useProductionByType,
  useLivestockProduction,
  type ProductionChartPoint,
  type ProductionRecord,
} from '@/lib/api/hooks';
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PLACEHOLDER_CHART_DATA: ProductionChartPoint[] = [
  { productType: 'Milk', value: 4_800_000, unit: 'tonnes' },
  { productType: 'Meat', value: 3_200_000, unit: 'tonnes' },
  { productType: 'Eggs', value: 1_900_000, unit: 'tonnes' },
  { productType: 'Wool', value: 320_000, unit: 'tonnes' },
  { productType: 'Hides', value: 580_000, unit: 'tonnes' },
  { productType: 'Honey', value: 210_000, unit: 'tonnes' },
];

const PLACEHOLDER_PRODUCTION: ProductionRecord[] = [
  {
    id: 'pr-1', country: 'Kenya', countryCode: 'KE', species: 'Cattle',
    productType: 'milk', quantity: 5_200_000, unit: 'litres',
    year: 2025, quarter: 4,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-02-15T14:00:00Z',
  },
  {
    id: 'pr-2', country: 'Ethiopia', countryCode: 'ET', species: 'Cattle',
    productType: 'meat', quantity: 980_000, unit: 'tonnes',
    year: 2025, quarter: 4,
    createdAt: '2026-01-12T08:00:00Z', updatedAt: '2026-02-10T12:00:00Z',
  },
  {
    id: 'pr-3', country: 'Nigeria', countryCode: 'NG', species: 'Poultry',
    productType: 'eggs', quantity: 620_000, unit: 'tonnes',
    year: 2025, quarter: 4,
    createdAt: '2026-01-08T09:00:00Z', updatedAt: '2026-02-08T11:00:00Z',
  },
  {
    id: 'pr-4', country: 'South Africa', countryCode: 'ZA', species: 'Sheep',
    productType: 'wool', quantity: 42_000, unit: 'tonnes',
    year: 2025,
    createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-02-12T16:00:00Z',
  },
  {
    id: 'pr-5', country: 'Tanzania', countryCode: 'TZ', species: 'Cattle',
    productType: 'hides', quantity: 78_000, unit: 'tonnes',
    year: 2025,
    createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'pr-6', country: 'Ethiopia', countryCode: 'ET', species: 'Bee',
    productType: 'honey', quantity: 54_000, unit: 'tonnes',
    year: 2025,
    createdAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-19T08:00:00Z',
  },
];

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  milk: 'Milk',
  meat: 'Meat',
  eggs: 'Eggs',
  wool: 'Wool',
  hides: 'Hides',
  honey: 'Honey',
};

export default function LivestockProductionPage() {
  const [page, setPage] = useState(1);
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const limit = 10;

  const {
    data: chartData,
    isLoading: chartLoading,
  } = useProductionByType({
    country: countryFilter || undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
  });

  const {
    data: tableData,
    isLoading: tableLoading,
    isError: tableError,
    error: tableErr,
    refetch: refetchTable,
  } = useLivestockProduction({
    page,
    limit,
    productType: productTypeFilter || undefined,
    country: countryFilter || undefined,
    year: yearFilter ? Number(yearFilter) : undefined,
  });

  const chartPoints = chartData?.data ?? PLACEHOLDER_CHART_DATA;
  const records = tableData?.data ?? PLACEHOLDER_PRODUCTION;
  const meta = tableData?.meta ?? {
    total: PLACEHOLDER_PRODUCTION.length,
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
          <h1 className="text-2xl font-bold text-gray-900">
            Livestock Production
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Production volumes by product type across the continent
          </p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Production by Product Type
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Continental aggregate production volumes (tonnes)
        </p>
        {chartLoading ? (
          <Skeleton className="mt-4 h-72 w-full" />
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="productType"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `${(v / 1_000).toFixed(0)}K`
                        : String(v)
                  }
                />
                <Tooltip
                  formatter={(value: number) => [
                    value.toLocaleString(),
                    'Tonnes',
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="value"
                  name="Production"
                  fill="#1B5E20"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={productTypeFilter}
            onChange={(e) => {
              setProductTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Products</option>
            <option value="milk">Milk</option>
            <option value="meat">Meat</option>
            <option value="eggs">Eggs</option>
            <option value="wool">Wool</option>
            <option value="hides">Hides</option>
            <option value="honey">Honey</option>
          </select>
          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Countries</option>
            <option value="ET">Ethiopia</option>
            <option value="KE">Kenya</option>
            <option value="NG">Nigeria</option>
            <option value="TZ">Tanzania</option>
            <option value="ZA">South Africa</option>
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
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {tableLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : tableError ? (
        <QueryError
          message={
            tableErr instanceof Error
              ? tableErr.message
              : 'Failed to load production data'
          }
          onRetry={() => refetchTable()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Country</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Species</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product Type</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Year</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Quarter</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{rec.country}</p>
                      <p className="text-xs text-gray-400">{rec.countryCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{rec.species}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-aris-primary-50 px-2 py-0.5 text-xs font-medium capitalize text-aris-primary-700">
                        {PRODUCT_TYPE_LABEL[rec.productType] ?? rec.productType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {rec.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{rec.unit}</td>
                    <td className="px-4 py-3 text-gray-700">{rec.year}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {rec.quarter ? `Q${rec.quarter}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(rec.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No production records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {records.length} of {meta.total} records
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
