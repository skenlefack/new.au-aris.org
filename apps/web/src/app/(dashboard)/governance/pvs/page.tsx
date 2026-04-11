'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, Plus, FileText, Clock, CheckCircle2, XCircle, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const TEMPLATES = ['9bbef204-8bec-4ed0-aa3d-290c6646e2d1'];
const PRIMARY = TEMPLATES[0];

const STATUS_CFG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

function scoreColor(s: number) {
  if (s >= 4) return 'text-green-700 bg-green-100';
  if (s >= 3) return 'text-yellow-700 bg-yellow-100';
  if (s >= 2) return 'text-orange-700 bg-orange-100';
  return 'text-red-700 bg-red-100';
}

export default function PvsPage() {
  const t = useTranslations('governance');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useMultiTemplateSubmissions(TEMPLATES, { limit: 50, status: statusFilter || undefined });
  const submissions: any[] = data?.data ?? [];
  const filtered = useMemo(() => { if (!search.trim()) return submissions; const q = search.toLowerCase(); return submissions.filter((s: any) => JSON.stringify(s.data ?? {}).toLowerCase().includes(q)); }, [submissions, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/governance" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pvs')}</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('pvsDesc')}</p></div>
        </div>
        <Link href={`/collecte/forms/${PRIMARY}/fill?returnTo=/governance/pvs`} className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus className="h-4 w-4" /> New Evaluation</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search evaluations..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></div>
        <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><option value="">{t('allStatus')}</option><option value="SUBMITTED">Submitted</option><option value="VALIDATED">Validated</option><option value="REJECTED">Rejected</option><option value="DRAFT">Draft</option></select></div>
        <span className="text-xs text-gray-400">{filtered.length} entries</span>
      </div>
      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      : !filtered.length ? <div className="flex flex-col items-center py-16 text-center"><Landmark className="h-12 w-12 text-gray-200 dark:text-gray-600" /><p className="mt-4 text-sm text-gray-400">{t('noEvaluationsFound')}</p><Link href={`/collecte/forms/${PRIMARY}/fill?returnTo=/governance/pvs`} className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"><Plus className="h-4 w-4" /> New Evaluation</Link></div>
      : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((sub: any) => {
          const d = sub.data ?? {}; const sc = STATUS_CFG[sub.status] ?? STATUS_CFG.DRAFT;
          const scores = [d.score_legislation, d.score_labs, d.score_risk_analysis, d.score_quarantine, d.score_surveillance, d.score_disease_control, d.score_food_safety, d.score_vet_education].filter(v => v != null).map(Number);
          const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          const loc = d.admin_location ?? {}; const cc = loc.level_0 ?? '';
          return (
            <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', sc.badge)}>{sc.icon}{sub.status}</span>
                {avg > 0 && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', scoreColor(avg))}>{avg.toFixed(1)}</span>}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                {cc && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{cc}</span>}
                {d.year && <span>{d.year}</span>}
                {d.evaluation_type && <span className="capitalize">{d.evaluation_type.replace(/_/g, ' ').toLowerCase()}</span>}
              </div>
              {scores.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[['Leg', d.score_legislation], ['Lab', d.score_labs], ['Risk', d.score_risk_analysis], ['Quar', d.score_quarantine], ['Surv', d.score_surveillance], ['Dis', d.score_disease_control], ['Food', d.score_food_safety], ['Vet', d.score_vet_education]].map(([lbl, val]) => (
                    <div key={String(lbl)} className="text-center">
                      <p className={cn('text-sm font-bold', val ? scoreColor(Number(val)).split(' ')[0] : 'text-gray-300')}>{val ?? '—'}</p>
                      <p className="text-[8px] text-gray-400">{String(lbl)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>);
        })}</div>}
    </div>
  );
}
