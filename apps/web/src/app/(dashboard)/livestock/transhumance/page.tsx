'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft,
  Filter,
  Plus,
  Route,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranshumanceCorridorMarker } from '@/components/maps/TranshumanceMap';
import { Skeleton, MapSkeleton } from '@/components/ui/Skeleton';
import { useFormSubmissions } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

const TranshumanceMap = dynamic(
  () => import('@/components/maps/TranshumanceMap').then((mod) => mod.TranshumanceMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

const TRANSHUMANCE_TEMPLATE_ID = 'b88344c4-257b-4637-9d55-8ec715e4df59';

const STATUS_BADGE: Record<string, { badge: string; dot: string }> = {
  active: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  inactive: { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', dot: 'bg-gray-400' },
  disrupted: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

const SUBMISSION_STATUS: Record<string, { badge: string; icon: React.ReactNode }> = {
  DRAFT: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  VALIDATED: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3 w-3" /> },
};

export default function TranshumancePage() {
  const t = useTranslations('livestock');
  const [statusFilter, setStatusFilter] = useState('');
  const [crossBorderFilter, setCrossBorderFilter] = useState('');

  const { data, isLoading } = useFormSubmissions(TRANSHUMANCE_TEMPLATE_ID, { page: 1, limit: 100 });
  const submissions: any[] = data?.data ?? [];

  // Filter
  const filtered = useMemo(() => {
    let list = submissions;
    if (statusFilter) {
      list = list.filter((s: any) => (s.data?.corridor_status ?? '') === statusFilter);
    }
    if (crossBorderFilter) {
      list = list.filter((s: any) => (s.data?.cross_border ?? '') === crossBorderFilter);
    }
    return list;
  }, [submissions, statusFilter, crossBorderFilter]);

  // Convert submissions to map corridors
  const mapCorridors: TranshumanceCorridorMarker[] = useMemo(() => {
    return filtered
      .filter((s: any) => s.data?.corridor_route && Array.isArray(s.data.corridor_route))
      .map((s: any) => ({
        id: s.id,
        name: s.data?.corridor_name ?? 'Unnamed corridor',
        route: s.data.corridor_route,
        status: s.data?.corridor_status ?? 'active',
        species: s.data?.species ?? '',
        estimatedAnimals: Number(s.data?.estimated_animals ?? 0),
      }));
  }, [filtered]);

  // KPIs
  const activeCount = filtered.filter((s: any) => s.data?.corridor_status === 'active').length;
  const disruptedCount = filtered.filter((s: any) => s.data?.corridor_status === 'disrupted').length;
  const totalAnimals = filtered.reduce((sum: number, s: any) => sum + Number(s.data?.estimated_animals ?? 0), 0);
  const crossBorderCount = filtered.filter((s: any) => s.data?.cross_border === 'true').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/livestock" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('corridorTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('corridorSubtitle')}</p>
          </div>
        </div>
        <Link
          href={`/collecte/forms/${TRANSHUMANCE_TEMPLATE_ID}/fill?returnTo=/livestock/transhumance`}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" /> {t('addCorridor')}
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('totalCorridors')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-600">{t('active')}</p>
          <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">{t('disrupted')}</p>
          <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">{disruptedCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('estimatedAnimals')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalAnimals.toLocaleString()}</p>
        </div>
      </div>

      {/* Map */}
      {isLoading ? (
        <MapSkeleton />
      ) : (
        <>
          <TranshumanceMap corridors={mapCorridors} height="500px" />
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="font-medium text-gray-700 dark:text-gray-300">{mapCorridors.length} {t('corridorsOnMap')}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />{t('active')}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9E9E9E]" />{t('inactive')}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C62828]" />{t('disrupted')}</span>
            <span className="ml-auto text-gray-400">{crossBorderCount} {t('crossBorder')}</span>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-orange-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <option value="">{t('allStatuses')}</option>
          <option value="active">{t('active')}</option>
          <option value="inactive">{t('inactive')}</option>
          <option value="disrupted">{t('disrupted')}</option>
        </select>
        <select value={crossBorderFilter} onChange={(e) => setCrossBorderFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-orange-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <option value="">{t('allMovements')}</option>
          <option value="true">{t('crossBorderOnly')}</option>
          <option value="false">{t('domesticOnly')}</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} {t('entries')}</span>
      </div>

      {/* Corridor Cards */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Route className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-400">{t('noCorridors')}</p>
          <Link href={`/collecte/forms/${TRANSHUMANCE_TEMPLATE_ID}/fill?returnTo=/livestock/transhumance`}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700">
            <Plus className="h-4 w-4" /> {t('addCorridor')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sub: any) => {
            const d = sub.data ?? {};
            const corridorStatus = STATUS_BADGE[d.corridor_status] ?? STATUS_BADGE.inactive;
            const subStatus = SUBMISSION_STATUS[sub.status] ?? SUBMISSION_STATUS.DRAFT;
            const originLoc = d.origin_location ?? {};
            const destLoc = d.destination_location ?? {};
            const hasRoute = d.corridor_route && Array.isArray(d.corridor_route) && d.corridor_route.length > 1;

            return (
              <div key={sub.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: d.corridor_status === 'active' ? '#2E7D32' : d.corridor_status === 'disrupted' ? '#C62828' : '#9E9E9E' }} />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', corridorStatus.dot)} />
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', corridorStatus.badge)}>
                      {d.corridor_status ?? 'unknown'}
                    </span>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', subStatus.badge)}>
                    {subStatus.icon} {sub.status}
                  </span>
                </div>

                <h4 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                  {d.corridor_name ?? 'Unnamed corridor'}
                </h4>

                {/* Origin → Destination */}
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{originLoc.level_0 ?? '?'}</span>
                  <span>→</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-700">{destLoc.level_0 ?? '?'}</span>
                  {d.cross_border === 'true' && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {t('crossBorder')}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {d.estimated_animals && (
                    <span><strong className="text-gray-900 dark:text-white">{Number(d.estimated_animals).toLocaleString()}</strong> animals</span>
                  )}
                  {d.season_start && d.season_end && (
                    <span>{new Date(d.season_start).toLocaleDateString()} → {new Date(d.season_end).toLocaleDateString()}</span>
                  )}
                  {hasRoute && (
                    <span className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      GPS ✓
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
