'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useVaccinationCampaigns,
  useVaccinationCoverage,
  type VaccinationCampaign,
  type VaccinationCoveragePoint,
} from '@/lib/api/hooks';
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_BADGE: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-700',
  suspended: 'bg-red-100 text-red-700',
};

const PLACEHOLDER_CAMPAIGNS: VaccinationCampaign[] = [
  {
    id: 'vc-1', name: 'FMD Ring Vaccination — Rift Valley', disease: 'FMD',
    country: 'Kenya', startDate: '2026-02-16', endDate: '2026-03-16',
    status: 'active', targetPopulation: 12000, dosesAdministered: 4520,
    coverage: 37.7, species: 'Cattle', createdAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'vc-2', name: 'PPR National Campaign', disease: 'PPR',
    country: 'Ethiopia', startDate: '2026-01-01', endDate: '2026-06-30',
    status: 'active', targetPopulation: 500000, dosesAdministered: 312000,
    coverage: 62.4, species: 'Sheep/Goat', createdAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'vc-3', name: 'HPAI Emergency Response', disease: 'HPAI',
    country: 'Nigeria', startDate: '2026-02-10', endDate: '2026-03-10',
    status: 'active', targetPopulation: 50000, dosesAdministered: 28000,
    coverage: 56.0, species: 'Poultry', createdAt: '2026-02-09T10:00:00Z',
  },
  {
    id: 'vc-4', name: 'LSD Prophylactic Campaign', disease: 'LSD',
    country: 'Egypt', startDate: '2026-03-01', endDate: '2026-05-31',
    status: 'planned', targetPopulation: 200000, dosesAdministered: 0,
    coverage: 0, species: 'Cattle', createdAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'vc-5', name: 'ND Village Poultry', disease: 'ND',
    country: 'Ghana', startDate: '2025-10-01', endDate: '2025-12-31',
    status: 'completed', targetPopulation: 80000, dosesAdministered: 72000,
    coverage: 90.0, species: 'Poultry', createdAt: '2025-09-15T10:00:00Z',
  },
  {
    id: 'vc-6', name: 'RVF Emergency Response', disease: 'RVF',
    country: 'Tanzania', startDate: '2026-01-25', endDate: '2026-02-25',
    status: 'completed', targetPopulation: 30000, dosesAdministered: 27500,
    coverage: 91.7, species: 'Cattle', createdAt: '2026-01-24T10:00:00Z',
  },
];

const PLACEHOLDER_COVERAGE: VaccinationCoveragePoint[] = [
  { month: 'Sep 2025', coverage: 68.2, target: 80 },
  { month: 'Oct 2025', coverage: 72.5, target: 80 },
  { month: 'Nov 2025', coverage: 76.1, target: 80 },
  { month: 'Dec 2025', coverage: 79.8, target: 80 },
  { month: 'Jan 2026', coverage: 83.4, target: 85 },
  { month: 'Feb 2026', coverage: 87.3, target: 85 },
];

export default function VaccinationPage() {
  const t = useTranslations('animalHealth');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const {
    data: campaignData,
    isLoading: campaignsLoading,
    isError: campaignsError,
    error: campaignsErr,
    refetch: refetchCampaigns,
  } = useVaccinationCampaigns({
    page,
    limit,
    status: statusFilter || undefined,
  });

  const {
    data: coverageData,
    isLoading: coverageLoading,
  } = useVaccinationCoverage();

  const campaigns = campaignData?.data ?? PLACEHOLDER_CAMPAIGNS;
  const meta = campaignData?.meta ?? {
    total: PLACEHOLDER_CAMPAIGNS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);
  const coveragePoints = coverageData?.data ?? PLACEHOLDER_COVERAGE;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/animal-health"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('vaccinationCampaigns')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('vaccinationSubtitle')}
          </p>
        </div>
      </div>

      {/* Coverage chart */}
      <div className="rounded-card border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          {t('coverageTrend')}
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          {t('coverageTrendDesc')}
        </p>
        {coverageLoading ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={coveragePoints}>
                <defs>
                  <linearGradient id="coverageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1B5E20" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="coverage"
                  stroke="#1B5E20"
                  strokeWidth={2}
                  fill="url(#coverageGrad)"
                  name="Coverage"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#E65100"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Target"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-600">{t('activeCampaignsCount')}</p>
          <p className="text-xl font-bold text-green-700">
            {campaigns.filter((c) => c.status === 'active').length}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">{t('totalDoses')}</p>
          <p className="text-xl font-bold text-gray-900">
            {campaigns
              .reduce((sum, c) => sum + c.dosesAdministered, 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-4">
          <p className="text-xs text-aris-primary-600">{t('avgCoverage')}</p>
          <p className="text-xl font-bold text-aris-primary-700">
            {campaigns.length > 0
              ? (
                  campaigns.reduce((sum, c) => sum + c.coverage, 0) /
                  campaigns.length
                ).toFixed(1)
              : 0}
            %
          </p>
        </div>
        <div className="rounded-card border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-600">{t('planned')}</p>
          <p className="text-xl font-bold text-blue-700">
            {campaigns.filter((c) => c.status === 'planned').length}
          </p>
        </div>
      </div>

      {/* Filter + Table */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">{t('allStatus')}</option>
          <option value="planned">{t('planned')}</option>
          <option value="active">{t('active')}</option>
          <option value="completed">{t('completed')}</option>
          <option value="suspended">{t('suspended')}</option>
        </select>
      </div>

      {campaignsLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : campaignsError ? (
        <QueryError
          message={
            campaignsErr instanceof Error
              ? campaignsErr.message
              : 'Failed to load campaigns'
          }
          onRetry={() => refetchCampaigns()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('campaign')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('disease')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('country')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('period')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('doses')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('coverage')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.species}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.disease}</td>
                    <td className="px-4 py-3 text-gray-700">{c.country}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_BADGE[c.status],
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.startDate).toLocaleDateString()} —{' '}
                      {new Date(c.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {c.dosesAdministered.toLocaleString()}
                      <span className="text-xs text-gray-400">
                        {' '}
                        / {c.targetPopulation.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              c.coverage >= 80
                                ? 'bg-green-500'
                                : c.coverage >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-red-500',
                            )}
                            style={{
                              width: `${Math.min(100, c.coverage)}%`,
                            }}
                          />
                        </div>
                        <span className="min-w-[3rem] text-right font-medium text-gray-900">
                          {c.coverage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      {t('noEventsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingEvents', { count: campaigns.length.toString(), total: meta.total.toString() })}
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
