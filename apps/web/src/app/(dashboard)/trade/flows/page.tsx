'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, Plus, FileText, Clock,
  CheckCircle2, XCircle, ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// Import and Export template
const FLOW_TEMPLATES = [
  '1417a1b1-e845-4767-8af6-25038fa86514', // Import and Export
];
const PRIMARY_TEMPLATE_ID = FLOW_TEMPLATES[0];

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

export default function TradeFlowsPage() {
  const t = useTranslations('trade');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(FLOW_TEMPLATES, {
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tradeFlows')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('tradeFlowsDesc')}</p>
          </div>
        </div>
        <Link href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/trade/flows`} className="flex items-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">
          <Plus className="h-4 w-4" /> {t('newTradeFlow')}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={t('searchFlows')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
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
          <ArrowRightLeft className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noFlowsFound')}</p>
          <Link href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/trade/flows`} className="mt-4 flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"><Plus className="h-4 w-4" /> {t('newTradeFlow')}</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const activity = d.activity ?? d.flow_direction ?? '';
            const source = d.source ?? d.export_country ?? '';
            const destination = d.destination ?? d.import_country ?? '';
            const product = d.product_name ?? d.product_type ?? d.commodity ?? '';
            const quantity = d.quantity ?? 0;
            const unit = d.unit ?? '';
            const value = d.estimated_value ?? d.value_fob ?? 0;
            const currency = d.currency ?? 'USD';
            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className={cn('absolute inset-x-0 top-0 h-1', activity?.toLowerCase?.() === 'export' ? 'bg-green-600' : 'bg-orange-600')} />
                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>{statusCfg.icon}{sub.status}</span>
                  {activity && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', activity.toLowerCase?.() === 'export' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>{activity}</span>}
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{product || '—'}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{source || '—'}</span><span className="text-gray-300">→</span><span className="font-medium">{destination || '—'}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div><p className="text-lg font-bold text-gray-900 dark:text-white">{quantity ? Number(quantity).toLocaleString() : '—'}</p><p className="text-[10px] text-gray-400">{unit || 'qty'}</p></div>
                  <div><p className="text-lg font-bold text-gray-900 dark:text-white">{value ? `${currency === 'USD' ? '$' : currency}${Number(value).toLocaleString()}` : '—'}</p><p className="text-[10px] text-gray-400">value</p></div>
                </div>
                {sub.submittedAt && <p className="mt-2 flex items-center gap-1 text-[10px] text-gray-400"><Clock className="h-3 w-3" />{new Date(sub.submittedAt).toLocaleDateString()}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
