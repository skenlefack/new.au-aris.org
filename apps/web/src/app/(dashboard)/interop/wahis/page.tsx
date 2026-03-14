'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Filter,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWahisExports, useCreateWahisExport, useCountries } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-700',
  exported: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function WahisExportsPage() {
  const t = useTranslations('interop');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const { data, isLoading } = useWahisExports({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const exports = data?.data ?? [];
  const meta = data?.meta;

  // New export form state
  const [formCountry, setFormCountry] = useState('');
  const [formType, setFormType] = useState('immediate');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formFormat, setFormFormat] = useState('JSON');

  const createExport = useCreateWahisExport();
  const { data: countriesData } = useCountries({ limit: 100 });
  const countries = countriesData?.data ?? [];

  function handleCreate() {
    if (!formCountry || !formStart || !formEnd) return;
    createExport.mutate(
      {
        country: formCountry,
        reportType: formType,
        periodStart: formStart,
        periodEnd: formEnd,
        format: formFormat,
      },
      { onSuccess: () => setShowNewForm(false) },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/interop"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToInteropHub')}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              WAHIS {t('exports')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('wahisDesc')}
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            {t('newExport')}
          </button>
        </div>
      </div>

      {/* New Export Form */}
      {showNewForm && (
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {t('createNewWahisExport')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Country
              </label>
              <select
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              >
                <option value="">Select...</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('reportType')}
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              >
                <option value="immediate">{t('reportTypeImmediate')}</option>
                <option value="followup">{t('reportTypeFollowUp')}</option>
                <option value="sixmonthly">{t('reportTypeSixMonthly')}</option>
                <option value="annual">{t('reportTypeAnnual')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('periodStart')}
              </label>
              <input
                type="date"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('periodEnd')}
              </label>
              <input
                type="date"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('format')}
              </label>
              <div className="flex gap-2 mt-1">
                {(['JSON', 'XML'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormFormat(f)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium',
                      formFormat === f
                        ? 'border-aris-primary-300 bg-aris-primary-100 text-aris-primary-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createExport.isPending || !formCountry || !formStart || !formEnd}
              className="rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {createExport.isPending ? 'Creating...' : t('createExport')}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="draft">{t('statusDraft')}</option>
          <option value="pending">{t('statusPending')}</option>
          <option value="exported">{t('statusExported')}</option>
          <option value="accepted">{t('statusAccepted')}</option>
          <option value="rejected">{t('statusRejected')}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : (
        <div className="rounded-card border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">{t('type')}</th>
                <th className="px-4 py-3">{t('period')}</th>
                <th className="px-4 py-3">{t('format')}</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">{t('exportedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exports.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/interop/wahis/${exp.id}`}
                      className="font-medium text-aris-primary-600 hover:text-aris-primary-700"
                    >
                      {exp.country}
                      <span className="ml-1 text-xs text-gray-400">
                        ({exp.countryCode})
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">
                    {exp.reportType}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {exp.period}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">
                      {exp.format}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {exp.recordCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        STATUS_COLORS[exp.status] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {exp.exportedAt
                      ? new Date(exp.exportedAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
              {exports.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {t('noWahisExportsFound')}
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
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * meta.limit >= meta.total}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
