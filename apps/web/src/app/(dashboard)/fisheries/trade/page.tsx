'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// AFADATA — Trade template
const TRADE_TEMPLATES = [
  '3d434ed8-8032-4294-a8bc-557ecc23798a', // Fish Trade Report
];
const PRIMARY_TEMPLATE_ID = TRADE_TEMPLATES[0];

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

const DIRECTION_COLORS: Record<string, string> = {
  EXPORT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  IMPORT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function FishTradePage() {
  const t = useTranslations('fisheries');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(TRADE_TEMPLATES, {
    limit: 50,
    status: statusFilter || undefined,
  });

  const submissions: any[] = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase();
    return submissions.filter((s: any) => {
      const d = s.data ?? {};
      return (
        JSON.stringify(d).toLowerCase().includes(q) ||
        (s.status ?? '').toLowerCase().includes(q)
      );
    });
  }, [submissions, search]);

  // Compute KPIs from real submission data
  const totalExports = filtered.reduce((sum: number, s: any) => {
    const d = s.data ?? {};
    if ((d.flow_direction ?? d.direction ?? '').toUpperCase() === 'EXPORT') {
      return sum + Number(d.value_fob ?? d.value ?? d.amount ?? 0);
    }
    return sum;
  }, 0);
  const totalImports = filtered.reduce((sum: number, s: any) => {
    const d = s.data ?? {};
    if ((d.flow_direction ?? d.direction ?? '').toUpperCase() === 'IMPORT') {
      return sum + Number(d.value_fob ?? d.value ?? d.amount ?? 0);
    }
    return sum;
  }, 0);
  const tradeBalance = totalExports - totalImports;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/fisheries"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('fishTrade')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('fishTradeDesc')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/trade`}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          {t('addTradeFlow')}
        </Link>
      </div>

      {/* KPI Cards — computed from submissions */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{t('totalExports')}</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              ${totalExports > 0 ? (totalExports / 1_000_000).toFixed(1) + 'M' : '0'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{t('totalImports')}</p>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              ${totalImports > 0 ? (totalImports / 1_000_000).toFixed(1) + 'M' : '0'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{t('tradeBalance')}</p>
              <ArrowUpDown className="h-5 w-5 text-teal-600" />
            </div>
            <p className={cn('mt-2 text-2xl font-bold', tradeBalance >= 0 ? 'text-green-700' : 'text-red-700')}>
              {tradeBalance >= 0 ? '+' : ''}${tradeBalance !== 0 ? (tradeBalance / 1_000_000).toFixed(1) + 'M' : '0'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchTrade')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-orange-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="">{t('allStatus')}</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VALIDATED">Validated</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <span className="text-xs text-gray-400">
          {filtered.length} {t('entries')}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ArrowUpDown className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noTradeFound')}</p>
          <Link
            href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/trade`}
            className="mt-4 flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            <Plus className="h-4 w-4" /> {t('addTradeFlow')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const direction = (d.flow_direction ?? d.direction ?? '').toUpperCase();
            const exportCountry = d.export_country ?? d.exporter ?? '';
            const importCountry = d.import_country ?? d.importer ?? '';
            const commodity = d.commodity ?? d.product ?? d.species ?? '';
            const productState = d.product_state ?? '';
            const quantity = d.quantity ?? d.weight ?? 0;
            const unit = d.unit ?? 'tonnes';
            const valueFob = d.value_fob ?? d.value ?? d.amount ?? 0;
            const currency = d.currency ?? 'USD';
            const periodStart = d.period_start ?? '';
            const periodEnd = d.period_end ?? '';
            const loc = d.admin_location ?? {};
            const countryCode = loc.level_0 ?? d.country_code ?? '';

            return (
              <div
                key={sub.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className={cn('absolute inset-x-0 top-0 h-1', direction === 'EXPORT' ? 'bg-green-600' : 'bg-orange-600')} />

                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>
                    {statusCfg.icon}
                    {sub.status}
                  </span>
                  {direction && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', DIRECTION_COLORS[direction] ?? 'bg-gray-100 text-gray-600')}>
                      {direction}
                    </span>
                  )}
                </div>

                {/* Commodity */}
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{commodity || '—'}</p>
                {productState && (
                  <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {productState}
                  </span>
                )}

                {/* Trade flow */}
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{exportCountry || countryCode || '—'}</span>
                  <span className="text-gray-300">→</span>
                  <span className="font-medium">{importCountry || '—'}</span>
                </div>

                {/* Key metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {quantity ? Number(quantity).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{unit}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {valueFob ? `${currency === 'USD' ? '$' : currency}${Number(valueFob).toLocaleString()}` : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">FOB value</p>
                  </div>
                </div>

                {/* Period */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {countryCode && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{countryCode}</span>
                  )}
                  {periodStart && periodEnd && (
                    <span>{periodStart} — {periodEnd}</span>
                  )}
                  {sub.submittedAt && !periodStart && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
