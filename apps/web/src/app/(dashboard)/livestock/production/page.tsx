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
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFormSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const PRODUCTION_TEMPLATE_ID = '2fedaa4f-3f43-4ad3-a383-7c895c1d536e';

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

const PRODUCT_COLORS: Record<string, string> = {
  milk: '#1565C0', meat: '#C62828', eggs: '#F9A825', wool: '#6A1B9A',
  hides: '#E65100', honey: '#2E7D32', other: '#546E7A',
};

// PRODUCT_LABELS is built dynamically in the component using t() — see getProductLabels below

export default function LivestockProductionPage() {
  const t = useTranslations('livestock');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const PRODUCT_LABELS: Record<string, string> = {
    milk: t('productMilk'), meat: t('productMeat'), eggs: t('productEggs'), wool: t('productWool'),
    hides: t('productHides'), honey: t('productHoney'), other: t('productOther'),
  };

  const { data, isLoading } = useFormSubmissions(PRODUCTION_TEMPLATE_ID, { page: 1, limit: 100, status: statusFilter || undefined });
  const submissions: any[] = data?.data ?? [];

  const filtered = useMemo(() => {
    let list = submissions;
    if (productFilter) {
      list = list.filter((s: any) => (s.data?.product_type ?? '') === productFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s: any) => JSON.stringify(s.data ?? {}).toLowerCase().includes(q));
    }
    return list;
  }, [submissions, productFilter, search]);

  // Aggregate by product type for chart
  const productAggregates = useMemo(() => {
    const agg: Record<string, { total: number; count: number }> = {};
    for (const s of submissions) {
      const pt = s.data?.product_type ?? 'other';
      const qty = Number(s.data?.quantity ?? 0);
      if (!agg[pt]) agg[pt] = { total: 0, count: 0 };
      agg[pt].total += qty;
      agg[pt].count += 1;
    }
    return Object.entries(agg).sort(([, a], [, b]) => b.total - a.total);
  }, [submissions]);

  const maxTotal = Math.max(...productAggregates.map(([, v]) => v.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/livestock" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('productionTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('productionSubtitle')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${PRODUCTION_TEMPLATE_ID}/fill?returnTo=/livestock/production`}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" /> {t('addProduction')}
        </Link>
      </div>

      {/* Production by product chart */}
      {!isLoading && productAggregates.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('productionByProduct')}</h2>
            <span className="ml-auto text-xs text-gray-400">{submissions.length} {t('entries')}</span>
          </div>
          <div className="space-y-3">
            {productAggregates.map(([pt, { total, count }]) => {
              const color = PRODUCT_COLORS[pt] ?? PRODUCT_COLORS.other;
              const label = PRODUCT_LABELS[pt] ?? pt;
              const pct = Math.round((total / maxTotal) * 100);
              return (
                <div key={pt} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div className="flex h-full items-center rounded-full px-2 text-[10px] font-bold text-white transition-all" style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color }}>
                      {total.toLocaleString()}
                    </div>
                  </div>
                  <span className="w-10 text-right text-[10px] text-gray-400">{count}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={t('searchProduction')} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <option value="">{t('allProducts')}</option>
            {Object.entries(PRODUCT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <option value="">{t('allStatus')}</option>
            <option value="SUBMITTED">{t('statusSubmitted')}</option>
            <option value="VALIDATED">{t('statusValidated')}</option>
            <option value="REJECTED">{t('statusRejected')}</option>
          </select>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} {t('entries')}</span>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BarChart3 className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noProdRecords')}</p>
          <Link href={`/collecte/forms/${PRODUCTION_TEMPLATE_ID}/fill?returnTo=/livestock/production`}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700">
            <Plus className="h-4 w-4" /> {t('addProduction')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const pt = d.product_type ?? 'other';
            const color = PRODUCT_COLORS[pt] ?? PRODUCT_COLORS.other;
            const loc = d.admin_location ?? {};
            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>
                    {statusCfg.icon} {sub.status}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: color }}>
                    {PRODUCT_LABELS[pt] ?? pt}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{d.quantity ? Number(d.quantity).toLocaleString() : '—'}</p>
                    <p className="text-[10px] text-gray-400">{d.unit ?? t('tonnes')}</p>
                  </div>
                  {d.market_value && (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">${Number(d.market_value).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">USD</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {loc.level_0 && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{loc.level_0}</span>}
                  {d.year && <span>{d.year}{d.reporting_period ? ` ${d.reporting_period}` : ''}</span>}
                  {d.data_source && <span className="truncate">{d.data_source}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
