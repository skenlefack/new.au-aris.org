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
  Ship,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// AFADATA — All vessel-related templates (old + new)
const VESSELS_TEMPLATES = [
  '1c5a9949-9a73-4b4f-a8da-0914a112e35a', // Vessel Registry (new)
  'bd1bcea3-42ad-4930-9b64-faf4a869597f', // Fishing Vessel Registration (legacy)
];
const PRIMARY_TEMPLATE_ID = VESSELS_TEMPLATES[0];

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

const LICENSE_COLORS: Record<string, string> = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function VesselsPage() {
  const t = useTranslations('fisheries');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(VESSELS_TEMPLATES, {
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('vesselTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('vesselSubtitle')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/vessels`}
          className="flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          <Plus className="h-4 w-4" />
          {t('addVessel')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchVessels')}
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
          <Ship className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noVesselsFound')}</p>
          <Link
            href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/vessels`}
            className="mt-4 flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700"
          >
            <Plus className="h-4 w-4" /> {t('addVessel')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const vesselName = d.vessel_name ?? d.name ?? '';
            const registration = d.registration_number ?? d.reg_number ?? '';
            const flag = d.flag ?? d.flag_country ?? '';
            const flagCode = d.flag_code ?? d.country_code ?? '';
            const vesselType = d.vessel_type ?? '';
            const length = d.length_meters ?? d.length ?? 0;
            const tonnage = d.tonnage ?? d.gross_tonnage ?? 0;
            const licenseStatus = d.license_status ?? '';
            const homePort = d.home_port ?? '';
            const loc = d.admin_location ?? {};
            const country = loc.level_0 ?? flagCode;

            return (
              <div
                key={sub.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />

                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>
                    {statusCfg.icon}
                    {sub.status}
                  </span>
                  {licenseStatus && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', LICENSE_COLORS[licenseStatus] ?? 'bg-gray-100 text-gray-600')}>
                      {licenseStatus}
                    </span>
                  )}
                </div>

                {/* Vessel name */}
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{vesselName || '—'}</p>
                {registration && (
                  <p className="mt-0.5 font-mono text-[11px] text-gray-400">{registration}</p>
                )}

                {/* Key metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{vesselType || '—'}</p>
                    <p className="text-[10px] text-gray-400">{t('type')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {length ? `${Number(length).toFixed(1)}m` : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('length')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {tonnage ? Number(tonnage).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('tonnage')}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {country && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{country}</span>
                  )}
                  {flag && flag !== country && (
                    <span>{flag}</span>
                  )}
                  {homePort && (
                    <span className="truncate">{homePort}</span>
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
