'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQualityReports } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const RESULT_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  corrected: 'bg-green-100 text-green-700',
  overridden: 'bg-blue-100 text-blue-700',
  accepted: 'bg-aris-primary-100 text-aris-primary-700',
};

const DOMAINS = [
  'Animal Health',
  'Livestock',
  'Fisheries',
  'Wildlife',
  'Apiculture',
  'Trade',
  'Governance',
  'Climate',
];

export default function QualityReportsPage() {
  const t = useTranslations('quality');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQualityReports({
    page,
    limit: 20,
    status: statusFilter || undefined,
    domain: domainFilter || undefined,
    result: resultFilter || undefined,
    search: search || undefined,
  });

  const reports = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/quality"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToDashboard')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {t('qualityReports')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('qualityReportsDesc')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchByEntity')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allResults')}</option>
            <option value="pass">{t('pass')}</option>
            <option value="fail">{t('fail')}</option>
            <option value="warning">{t('warning')}</option>
          </select>
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allDomains')}</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="corrected">{t('corrected')}</option>
            <option value="overridden">{t('overridden')}</option>
            <option value="accepted">{t('accepted')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={6} />
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
                <th className="px-4 py-3">{t('violations')}</th>
                <th className="px-4 py-3">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/quality/reports/${r.id}`}
                      className="font-medium text-aris-primary-600 hover:underline"
                    >
                      {r.entityTitle}
                    </Link>
                    <p className="text-xs text-gray-400">{r.entityType}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.domain}</td>
                  <td className="px-4 py-3 text-gray-600">{r.country}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        RESULT_STYLES[r.overallResult] ?? RESULT_STYLES.pass,
                      )}
                    >
                      {r.overallResult === 'fail' && (
                        <XCircle className="h-3 w-3" />
                      )}
                      {r.overallResult === 'warning' && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {r.overallResult === 'pass' && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {t(r.overallResult)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[r.status] ?? STATUS_STYLES.pending,
                      )}
                    >
                      {t(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.violations.length}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    {t('noReportsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {t('showing')} {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('previous')}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * meta.limit >= meta.total}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
