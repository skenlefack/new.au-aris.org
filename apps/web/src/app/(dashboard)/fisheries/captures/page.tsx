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
  Anchor,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// AFADATA — All capture-related templates (old + new)
const CAPTURES_TEMPLATES = [
  '85e8dfac-bd69-4107-b166-7906c3360a99', // Monthly Captures Report (new)
  '7de1ef69-e845-4767-8af6-25038fa86514', // Capture Fisheries Report (legacy)
];
const PRIMARY_TEMPLATE_ID = CAPTURES_TEMPLATES[0];

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

export default function CapturesPage() {
  const t = useTranslations('fisheries');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(CAPTURES_TEMPLATES, {
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('captures')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('capturesDesc')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/captures`}
          className="flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          <Plus className="h-4 w-4" />
          {t('addCapture')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchCaptures')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
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
          <Anchor className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noCapturesFound')}</p>
          <p className="mt-1 text-xs text-gray-300">{t('noCapturesDesc') || t('capturesDesc')}</p>
          <Link
            href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/captures`}
            className="mt-4 flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700"
          >
            <Plus className="h-4 w-4" /> {t('addCapture')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const species = d.species ?? d.species_name ?? '';
            const quantity = d.quantity_kg ?? d.quantity ?? d.catch_quantity ?? 0;
            const unit = d.unit ?? 'kg';
            const faoArea = d.fao_area ?? d.fao_area_code ?? '';
            const catchMethod = d.catch_method ?? d.gear_type ?? '';
            const year = d.year ?? d.capture_year ?? '';
            const quarter = d.quarter ?? '';
            const landingSite = d.landing_site ?? '';
            const loc = d.admin_location ?? {};
            const countryCode = loc.level_0 ?? d.country_code ?? '';

            return (
              <div
                key={sub.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-cyan-600" />

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

                {/* Species */}
                {species && (
                  <p className="mt-2 text-sm font-medium italic text-gray-700 dark:text-gray-300">{species}</p>
                )}

                {/* Key metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {quantity ? Number(quantity).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{unit}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {catchMethod || '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('catchMethod')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {year}{quarter ? ` Q${quarter}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('period')}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {countryCode && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{countryCode}</span>
                  )}
                  {faoArea && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {faoArea}
                    </span>
                  )}
                  {landingSite && (
                    <span className="truncate">{landingSite}</span>
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
