'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFormSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// Template ID for "Animal Population and Composition"
const CENSUS_TEMPLATE_ID = 'b3d0d91a-bb21-4ae4-a0c7-951efa828947';

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

export default function LivestockCensusPage() {
  const t = useTranslations('livestock');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useFormSubmissions(CENSUS_TEMPLATE_ID, {
    page: 1,
    limit: 50,
    status: statusFilter || undefined,
  });

  const submissions: any[] = data?.data ?? [];

  // Client-side search filter
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/livestock"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('censusData')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('censusDataDesc')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${CENSUS_TEMPLATE_ID}/fill?returnTo=/livestock/census`}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          {t('addCensusEntry')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchCensus')}
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
            <option value="SUBMITTED">{t('statusSubmitted')}</option>
            <option value="VALIDATED">{t('statusValidated')}</option>
            <option value="REJECTED">{t('statusRejected')}</option>
            <option value="DRAFT">{t('statusDraft')}</option>
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
          <FileText className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noDataFound')}</p>
          <p className="mt-1 text-xs text-gray-300">{t('noCensusDataDesc')}</p>
          <Link
            href={`/collecte/forms/${CENSUS_TEMPLATE_ID}/fill?returnTo=/livestock/census`}
            className="mt-4 flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            <Plus className="h-4 w-4" /> {t('addCensusEntry')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const year = d.year_of_report ?? d.Year_of_Report ?? '';
            const numAnimals = d.number_of_animals ?? d.Number_of_Animals ?? 0;
            const mortality = d.mortality_number ?? d.Mortality_Number ?? 0;
            const offtake = d.offtake_number ?? d.Offtake_Number ?? 0;

            // Try to extract location info
            const loc = d.admin_location ?? {};
            const countryCode = loc.level_0 ?? '';

            return (
              <div
                key={sub.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-orange-500" />

                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>
                    {statusCfg.icon}
                    {sub.status}
                  </span>
                  {sub.submittedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Key metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {numAnimals ? Number(numAnimals).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('population')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {mortality ? Number(mortality).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('mortality')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {offtake ? Number(offtake).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('offtake')}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {countryCode && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{countryCode}</span>
                  )}
                  {year && (
                    <span>{t('year')}: {year}</span>
                  )}
                  {d.data_source && (
                    <span className="truncate">{d.data_source}</span>
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
