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
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMultiTemplateSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

// AFADATA — Aquaculture templates
const AQUACULTURE_TEMPLATES = [
  '3de22cf6-e4e0-4a89-9834-34abc578c809', // Aquaculture Farm Report
  'fb89abc3-4a73-4d05-8968-47084f8e646d', // Aquaculture Farm Registration
  'fa9c5e5d-f166-4ba0-9815-5027e1e149bf', // Aquaculture Production Report
];
const PRIMARY_TEMPLATE_ID = AQUACULTURE_TEMPLATES[0];

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

const FARM_TYPE_COLORS: Record<string, string> = {
  pond: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  cage: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  raceway: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  recirculating: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  tank: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function AquaculturePage() {
  const t = useTranslations('fisheries');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useMultiTemplateSubmissions(AQUACULTURE_TEMPLATES, {
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

  // Compute summary KPIs from real data
  const activeFarms = filtered.filter((s: any) => {
    const status = s.data?.farm_status ?? s.data?.status ?? '';
    return status === 'active' || s.status === 'VALIDATED';
  });
  const totalProduction = filtered.reduce((sum: number, s: any) => {
    const prod = Number(s.data?.production_tonnes ?? s.data?.production ?? 0);
    return sum + prod;
  }, 0);
  const totalArea = filtered.reduce((sum: number, s: any) => {
    const area = Number(s.data?.area_hectares ?? s.data?.area ?? 0);
    return sum + area;
  }, 0);
  const avgArea = filtered.length > 0 ? totalArea / filtered.length : 0;

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('aquaTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('aquaSubtitle')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/aquaculture`}
          className="flex items-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          <Plus className="h-4 w-4" />
          {t('addFarm')}
        </Link>
      </div>

      {/* Summary cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-xs text-green-600 dark:text-green-400">{t('activeFarms')}</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">{activeFarms.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-400">Total Production</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {totalProduction.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-400">tonnes</span>
            </p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-900/20">
            <p className="text-xs text-cyan-600 dark:text-cyan-400">Average Area</p>
            <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
              {avgArea.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-cyan-400">ha</span>
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
            placeholder={t('searchFarms')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
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
          <Warehouse className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noFarmsFound')}</p>
          <Link
            href={`/collecte/forms/${PRIMARY_TEMPLATE_ID}/fill?returnTo=/fisheries/aquaculture`}
            className="mt-4 flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"
          >
            <Plus className="h-4 w-4" /> {t('addFarm')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.DRAFT;
            const farmName = d.farm_name ?? d.name ?? '';
            const species = d.species ?? d.species_name ?? '';
            const farmType = d.farm_type ?? '';
            const production = d.production_tonnes ?? d.production ?? 0;
            const area = d.area_hectares ?? d.area ?? 0;
            const farmStatus = d.farm_status ?? d.operational_status ?? '';
            const loc = d.admin_location ?? {};
            const countryCode = loc.level_0 ?? d.country_code ?? '';

            return (
              <div
                key={sub.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-green-600" />

                <div className="flex items-center justify-between">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', statusCfg.badge)}>
                    {statusCfg.icon}
                    {sub.status}
                  </span>
                  {farmType && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', FARM_TYPE_COLORS[farmType] ?? 'bg-gray-100 text-gray-600')}>
                      {farmType}
                    </span>
                  )}
                </div>

                {/* Farm name */}
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{farmName || '—'}</p>
                {species && (
                  <p className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">{species}</p>
                )}

                {/* Key metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {production ? Number(production).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('prodTonnes')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {area ? Number(area).toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">{t('areaHa')}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {countryCode && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{countryCode}</span>
                  )}
                  {farmStatus && farmStatus !== farmType && (
                    <span className="capitalize">{farmStatus}</span>
                  )}
                  {sub.submittedAt && (
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
