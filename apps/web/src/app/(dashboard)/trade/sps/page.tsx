'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, Plus, FileText, Clock,
  CheckCircle2, XCircle, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// Quality Standards templates
const SPS_TEMPLATES = [
  '54ffd1d3-e845-4767-8af6-25038fa86514', // Quality Standards (Inputs & Services)
  '957b5a13-e845-4767-8af6-25038fa86514', // Quality Standards (Poultry/Hatchery)
];
const PRIMARY_TEMPLATE_ID = SPS_TEMPLATES[0];

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

export default function SpsPage() {
  const t = useTranslations('trade');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(SPS_TEMPLATES, {
    limit: 50, status: statusFilter || undefined,
  });
  const submissions: any[] = data?.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase();
    return submissions.filter((s: any) => JSON.stringify(s.data ?? {}).toLowerCase().includes(q));
  }, [submissions, search]);

  // KPIs from submissions
  const totalCerts = filtered.length;
  const validated = filtered.filter((s: any) => s.status === 'VALIDATED').length;
  const passRate = totalCerts > 0 ? Math.round((validated / totalCerts) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/trade" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('spsCertification')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('spsDesc')}</p>
          </div>
        </div>
        <Link href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/trade/sps`} className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          <Plus className="h-4 w-4" /> {t('newAssessment')}
        </Link>
      </div>

      {/* KPI summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-xs text-blue-600 dark:text-blue-400">{t('totalAssessments')}</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{totalCerts}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-xs text-green-600 dark:text-green-400">{t('validatedCount')}</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">{validated}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-400">{t('validationRate')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{passRate}%</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={t('searchCertificates')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
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
          <ShieldCheck className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noCertificatesFound')}</p>
          <Link href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/trade/sps`} className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"><Plus className="h-4 w-4" /> {t('newAssessment')}</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            // Quality standards have yes/no fields — count compliance
            const yesCount = Object.values(d).filter((v) => v === 'yes' || v === true).length;
            const noCount = Object.values(d).filter((v) => v === 'no' || v === false).length;
            const total = yesCount + noCount;
            const complianceRate = total > 0 ? Math.round((yesCount / total) * 100) : 0;
            const loc = d.admin_location ?? {};
            const countryCode = loc.level_0 ?? '';

            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>{statusCfg.icon}{sub.status}</span>
                  {sub.submittedAt && <span className="flex items-center gap-1 text-[10px] text-gray-400"><Clock className="h-3 w-3" />{new Date(sub.submittedAt).toLocaleDateString()}</span>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div><p className="text-lg font-bold text-green-600">{yesCount}</p><p className="text-[10px] text-gray-400">{t('compliant')}</p></div>
                  <div><p className="text-lg font-bold text-red-600">{noCount}</p><p className="text-[10px] text-gray-400">{t('nonCompliant')}</p></div>
                  <div><p className="text-lg font-bold text-gray-900 dark:text-white">{complianceRate}%</p><p className="text-[10px] text-gray-400">{t('score')}</p></div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${complianceRate}%` }} />
                </div>
                {countryCode && <div className="mt-2 flex items-center gap-2 text-xs text-gray-500"><span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{countryCode}</span></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
