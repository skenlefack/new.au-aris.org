'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, Plus, FileText, Clock, CheckCircle2, XCircle, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const TEMPLATES = ['6636536f-72de-4f30-b04d-3210e7cf3934'];
const PRIMARY = TEMPLATES[0];

const STATUS_CFG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};
const TYPE_COLORS: Record<string, string> = { LAW: 'bg-indigo-100 text-indigo-700', REGULATION: 'bg-blue-100 text-blue-700', POLICY: 'bg-teal-100 text-teal-700', STANDARD: 'bg-amber-100 text-amber-700', GUIDELINE: 'bg-gray-100 text-gray-600' };

export default function LegalFrameworksPage() {
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
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('legalFrameworks')}</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('legalFrameworksDesc')}</p></div>
        </div>
        <Link href={`/collecte/forms/${PRIMARY}/fill?returnTo=/governance/legal-frameworks`} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> New Framework</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search frameworks..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></div>
        <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><option value="">{t('allStatus')}</option><option value="SUBMITTED">Submitted</option><option value="VALIDATED">Validated</option><option value="REJECTED">Rejected</option><option value="DRAFT">Draft</option></select></div>
        <span className="text-xs text-gray-400">{filtered.length} entries</span>
      </div>
      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      : !filtered.length ? <div className="flex flex-col items-center py-16 text-center"><Scale className="h-12 w-12 text-gray-200 dark:text-gray-600" /><p className="mt-4 text-sm text-gray-400">{t('noFrameworksFound')}</p><Link href={`/collecte/forms/${PRIMARY}/fill?returnTo=/governance/legal-frameworks`} className="mt-4 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"><Plus className="h-4 w-4" /> New Framework</Link></div>
      : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((sub: any) => {
          const d = sub.data ?? {}; const sc = STATUS_CFG[sub.status] ?? STATUS_CFG.DRAFT;
          const fwType = d.framework_type ?? ''; const fwStatus = d.status ?? '';
          const loc = d.admin_location ?? {}; const cc = loc.level_0 ?? '';
          return (
            <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="absolute inset-x-0 top-0 h-1 bg-indigo-600" />
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', sc.badge)}>{sc.icon}{sub.status}</span>
                {fwType && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TYPE_COLORS[fwType] ?? 'bg-gray-100 text-gray-600')}>{fwType}</span>}
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{d.framework_title || '—'}</p>
              {d.domain && <p className="mt-0.5 text-xs text-gray-500 capitalize">{d.domain?.replace(/_/g, ' ')}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {cc && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{cc}</span>}
                {fwStatus && <span className="capitalize">{fwStatus.toLowerCase()}</span>}
                {d.adoption_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.adoption_date}</span>}
              </div>
            </div>);
        })}</div>}
    </div>
  );
}
