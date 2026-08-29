'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, Plus, FileText, Clock,
  CheckCircle2, XCircle, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// Market-related templates
const MARKET_TEMPLATES = [
  '2dc97820-e845-4767-8af6-25038fa86514', // Market Price
  '195d45ed-e845-4767-8af6-25038fa86514', // Market Demand
  '45edd19c-e845-4767-8af6-25038fa86514', // Market Requirement and Location
];
const PRIMARY_TEMPLATE_ID = MARKET_TEMPLATES[0]; // Market Price

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

export default function MarketsPage() {
  const t = useTranslations('trade');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(MARKET_TEMPLATES, {
    limit: 50, status: statusFilter || undefined,
  });
  const submissions: any[] = data?.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase();
    return submissions.filter((s: any) => JSON.stringify(s.data ?? {}).toLowerCase().includes(q));
  }, [submissions, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/trade" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('markets')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('marketsDesc')}</p>
          </div>
        </div>
        <Link href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/trade/markets`} className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> {t('newMarketData')}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={t('searchMarkets')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <option value="">{t('allStatus')}</option>
            <option value="SUBMITTED">{t('statusSubmitted')}</option>
            <option value="VALIDATED">{t('statusValidated')}</option>
            <option value="REJECTED">{t('statusRejected')}</option>
            <option value="DRAFT">{t('statusDraft')}</option>
          </select>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} {t('entries')}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Store className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noMarketsFound')}</p>
          <Link href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/trade/markets`} className="mt-4 flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"><Plus className="h-4 w-4" /> {t('newMarketData')}</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const species = d.species ?? d.animal_species ?? '';
            const breed = d.breed ?? '';
            const product = d.product ?? d.product_type ?? '';
            const price = d.animal_price ?? d.live_animal_price ?? d.price ?? 0;
            const weight = d.live_weight_kg ?? d.quantity ?? 0;
            const demand = d.monthly_demand_kg ?? 0;
            const demandType = d.demand_type ?? '';
            const marketType = d.market_type ?? '';
            const loc = d.admin_location ?? {};
            const countryCode = loc.level_0 ?? '';
            const date = d.date ?? '';

            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>{statusCfg.icon}{sub.status}</span>
                  {(marketType || demandType) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 capitalize dark:bg-amber-900/30 dark:text-amber-400">{marketType || demandType}</span>}
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{species || product || '—'}</p>
                {breed && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{breed}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {price > 0 && <div><p className="text-lg font-bold text-gray-900 dark:text-white">${Number(price).toLocaleString()}</p><p className="text-[10px] text-gray-400">{t('price')}</p></div>}
                  {weight > 0 && <div><p className="text-lg font-bold text-gray-900 dark:text-white">{Number(weight).toLocaleString()}</p><p className="text-[10px] text-gray-400">kg</p></div>}
                  {demand > 0 && <div><p className="text-lg font-bold text-gray-900 dark:text-white">{Number(demand).toLocaleString()}</p><p className="text-[10px] text-gray-400">{t('monthlyDemand')} (kg)</p></div>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {countryCode && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{countryCode}</span>}
                  {date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{date}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
