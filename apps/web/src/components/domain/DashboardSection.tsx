'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Pencil,
  Star,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import {
  useDefaultDashboard,
  useDashboard,
  useDashboards,
  useDashboardRender,
  useSetDashboardPreference,
  type DashboardScope,
} from '@/lib/api/dashboard-hooks';
import { SectionList } from '@/components/dashboard-builder/SectionList';

interface DashboardTarget {
  domainId?: string;
  subDomainId?: string;
}

interface DashboardSectionProps {
  scope: DashboardScope;
  target: DashboardTarget;
  domainCode?: string;
  /** Display zone label */
  zone?: 'principal' | 'domain';
}

function pickDashTitle(d: any, locale: string): string {
  switch (locale) {
    case 'en': return d?.title_en || d?.titleEn || d?.title_fr || d?.titleFr || d?.title || '';
    case 'pt': return d?.title_pt || d?.titlePt || d?.title_fr || d?.titleFr || d?.title || '';
    case 'ar': return d?.title_ar || d?.titleAr || d?.title_fr || d?.titleFr || d?.title || '';
    case 'es': return d?.title_es || d?.titleEs || d?.title_fr || d?.titleFr || d?.title || '';
    case 'sw': return d?.title_sw || d?.titleSw || d?.title_en || d?.titleEn || d?.title || '';
    default:   return d?.title_fr || d?.titleFr || d?.title || d?.title_en || d?.titleEn || '';
  }
}

export function DashboardSection({ scope, target, domainCode, zone = 'domain' }: DashboardSectionProps) {
  const t = useTranslations('dashboard');
  const locale = useLocaleStore((s) => s.locale);
  const ZONE_LABELS = {
    principal: t('zonePrincipal'),
    domain: t('zoneDomain'),
  };
  const targetKey = target.subDomainId
    ? `sub:${target.subDomainId}`
    : target.domainId
      ? `domain:${target.domainId}`
      : 'global';

  const { data: defaultData, isLoading: defaultLoading } = useDefaultDashboard(scope, targetKey);
  const { data: listData } = useDashboards({ scope, domainCode, limit: 50 });
  const setPreference = useSetDashboardPreference();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dashboards = listData?.data ?? [];
  const defaultDashboard = defaultData?.data ?? null;
  const activeDashboardId = selectedId ?? defaultDashboard?.id ?? null;

  // Use getById for sections/widgets structure, render for widget data
  const { data: dashDetail, isLoading: detailLoading } = useDashboard(activeDashboardId ?? '');
  const { data: renderData } = useDashboardRender(activeDashboardId ?? '');

  const loadedDashboard = dashDetail?.data ?? null;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<string, Record<string, unknown>>;
  const renderLoading = detailLoading;

  const d = loadedDashboard as any;
  const dashTitle = pickDashTitle(d, locale);

  const handleSetDefault = () => {
    if (!activeDashboardId) return;
    setPreference.mutate({ dashboardId: activeDashboardId, scope, target: targetKey });
  };

  if (defaultLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const fullscreenClasses = isFullscreen
    ? 'fixed inset-0 z-50 overflow-auto bg-white dark:bg-gray-900 p-6'
    : '';

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800', fullscreenClasses)}>
      {/* Header — zone label + dashboard title + selector + actions on ONE line */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        {/* Left: zone icon + zone label */}
        <LayoutDashboard className="h-4 w-4 text-[#1F4E79] shrink-0" />
        <span className="text-xs font-medium text-gray-400 shrink-0">
          {ZONE_LABELS[zone]}
        </span>

        {/* Dashboard title */}
        {dashTitle && (
          <>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {dashTitle}
            </h2>
          </>
        )}

        {/* Default badge */}
        {activeDashboardId && activeDashboardId === defaultDashboard?.id && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
            {t('defaultBadge')}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Dashboard selector dropdown */}
        {dashboards.length > 0 && (
          <div className="relative shrink-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {t('changeDashboard')}
              <ChevronDown className={cn('h-3 w-3 transition-transform', dropdownOpen && 'rotate-180')} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {dashboards.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelectedId(d.id);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700',
                        d.id === activeDashboardId
                          ? 'bg-[#1F4E79]/5 text-[#1F4E79] font-medium dark:bg-[#1F4E79]/10'
                          : 'text-gray-700 dark:text-gray-300',
                      )}
                    >
                      {d.isDefault && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
                      <span className="truncate">{d.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Set as default */}
        {activeDashboardId && activeDashboardId !== defaultDashboard?.id && (
          <button
            onClick={handleSetDefault}
            disabled={setPreference.isPending}
            className="rounded-md p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 shrink-0"
            title={t('setAsDefault')}
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Edit */}
        {activeDashboardId && (
          <Link
            href={`/dashboards/${activeDashboardId}/edit`}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 shrink-0"
            title={t('editDashboard')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        )}

        {/* Fullscreen */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 shrink-0"
          title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {renderLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : loadedDashboard && ((loadedDashboard as any).sections?.length > 0 || (loadedDashboard as any).widgets?.length > 0) ? (
          <SectionList
            sections={(loadedDashboard as any).sections ?? []}
            widgetData={widgetData}
            editable={false}
          />
        ) : (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
            <LayoutDashboard className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('noDashboardConfigured')}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {t('createDashboardHint')}
            </p>
            <Link
              href={`/my-dashboards${domainCode ? `?domain=${domainCode}` : ''}`}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a4060]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('createDashboard')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
