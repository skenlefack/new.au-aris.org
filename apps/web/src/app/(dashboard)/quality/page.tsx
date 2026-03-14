'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQualityDashboard } from '@/lib/api/hooks';
import { KpiCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const DOMAIN_COLORS: Record<string, string> = {
  'Animal Health': 'bg-red-500',
  Livestock: 'bg-green-500',
  Fisheries: 'bg-blue-500',
  Wildlife: 'bg-amber-500',
  Trade: 'bg-purple-500',
  Governance: 'bg-teal-500',
};

function PassRateBar({ rate }: { rate: number }) {
  const color =
    rate >= 90
      ? 'bg-green-500'
      : rate >= 70
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700">
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

export default function QualityDashboardPage() {
  const t = useTranslations('quality');
  const { data, isLoading } = useQualityDashboard();

  const dashboard = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/quality/reports"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('viewReports')}
          </Link>
          <Link
            href="/quality/rules"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('manageRules')}
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : dashboard ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-card border border-green-200 bg-green-50 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                {t('overallPassRate')}
              </span>
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-kpi text-gray-900">
                {dashboard.overallPassRate.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">%</span>
            </div>
            <div
              className={cn(
                'mt-3 flex items-center gap-1 text-sm',
                dashboard.passRateTrend >= 0 ? 'text-green-700' : 'text-red-700',
              )}
            >
              {dashboard.passRateTrend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span className="font-medium">
                {dashboard.passRateTrend > 0 ? '+' : ''}
                {dashboard.passRateTrend}%
              </span>
              <span className="text-gray-500">{t('vsLastMonth')}</span>
            </div>
          </div>

          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                {t('totalReports')}
              </span>
              <CheckCircle2 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 text-kpi text-gray-900">
              {dashboard.totalReports.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-gray-500">{t('allTime')}</div>
          </div>

          <div className="rounded-card border border-amber-200 bg-amber-50 p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                {t('pendingCorrections')}
              </span>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-2 text-kpi text-gray-900">
              {dashboard.pendingCorrections}
            </div>
            <div className="mt-3 text-sm text-amber-700">{t('awaitingFix')}</div>
          </div>

          <div className="rounded-card border border-gray-200 bg-white p-card shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-kpi-label uppercase tracking-wider text-gray-500">
                {t('avgCorrectionTime')}
              </span>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-kpi text-gray-900">
                {dashboard.avgCorrectionTime.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">{t('hrs')}</span>
            </div>
            <div
              className={cn(
                'mt-3 flex items-center gap-1 text-sm',
                dashboard.correctionTimeTrend <= 0
                  ? 'text-green-700'
                  : 'text-red-700',
              )}
            >
              <span className="font-medium">
                {dashboard.correctionTimeTrend > 0 ? '+' : ''}
                {dashboard.correctionTimeTrend}%
              </span>
              <span className="text-gray-500">
                {dashboard.correctionTimeTrend <= 0 ? t('improving') : t('vsLastMonth')}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pass rates by domain */}
        <div className="rounded-card border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            {t('passRateByDomain')}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(dashboard?.byDomain ?? []).map((d) => (
                <div key={d.domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        DOMAIN_COLORS[d.domain] ?? 'bg-gray-400',
                      )}
                    />
                    <span className="text-sm text-gray-700 truncate">
                      {d.domain}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <PassRateBar rate={d.passRate} />
                    <span className="text-xs text-gray-400 w-20 text-right">
                      {d.failedRecords} / {d.totalRecords} {t('failed')}
                    </span>
                  </div>
                </div>
              ))}
              {(dashboard?.byDomain ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {t('noDomainData')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Pass rates by gate */}
        <div className="rounded-card border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            {t('passRateByGate')}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(dashboard?.byGate ?? []).map((g) => (
                <div key={g.gate} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate min-w-0">
                    {g.gate}
                  </span>
                  <div className="flex items-center gap-4">
                    <PassRateBar rate={g.passRate} />
                    <div className="flex items-center gap-2 text-xs w-24 justify-end">
                      <span className="text-red-500">{g.failCount} F</span>
                      <span className="text-amber-500">{g.warningCount} W</span>
                    </div>
                  </div>
                </div>
              ))}
              {(dashboard?.byGate ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {t('noGateData')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent failures */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {t('recentFailures')}
          </h2>
          <Link
            href="/quality/reports?result=fail"
            className="flex items-center gap-1 text-xs text-aris-primary-600 hover:underline"
          >
            {t('viewAll')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : (
          <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">{t('entity')}</th>
                  <th className="px-4 py-3">{t('domain')}</th>
                  <th className="px-4 py-3">{t('country')}</th>
                  <th className="px-4 py-3">{t('result')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(dashboard?.recentFailures ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/quality/reports/${r.id}`}
                        className="font-medium text-aris-primary-600 hover:underline"
                      >
                        {r.entityTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.domain}</td>
                    <td className="px-4 py-3 text-gray-600">{r.country}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          r.overallResult === 'fail'
                            ? 'bg-red-100 text-red-700'
                            : r.overallResult === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700',
                        )}
                      >
                        {r.overallResult === 'fail' && (
                          <XCircle className="h-3 w-3" />
                        )}
                        {r.overallResult === 'warning' && (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {t(r.overallResult)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          r.status === 'corrected'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'overridden'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {t(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(dashboard?.recentFailures ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      {t('noRecentFailures')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
