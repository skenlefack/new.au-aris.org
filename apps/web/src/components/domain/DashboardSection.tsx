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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useDefaultDashboard,
  useDashboards,
  useDashboardRender,
  useSetDashboardPreference,
  type DashboardScope,
} from '@/lib/api/dashboard-hooks';
import { DashboardGrid } from '@/components/dashboard-builder/DashboardGrid';

interface DashboardTarget {
  domainId?: string;
  subDomainId?: string;
}

interface DashboardSectionProps {
  scope: DashboardScope;
  target: DashboardTarget;
  domainCode?: string;
}

/**
 * Section that renders the user's default (or chosen) dashboard.
 *
 * 1. Loads the default dashboard via useDefaultDashboard
 * 2. Lets user pick another dashboard from a dropdown
 * 3. Buttons: Edit, Set as default, Fullscreen
 * 4. Renders DashboardGrid in read mode
 * 5. Placeholder when no dashboard is configured
 */
export function DashboardSection({ scope, target, domainCode }: DashboardSectionProps) {
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

  const { data: renderData, isLoading: renderLoading } = useDashboardRender(activeDashboardId ?? '');

  const renderedDashboard = renderData?.data?.dashboard ?? null;
  const widgetData = (renderData?.data?.widgetData ?? {}) as Record<string, Record<string, unknown>>;

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

  // Fullscreen wrapper
  const fullscreenClasses = isFullscreen
    ? 'fixed inset-0 z-50 overflow-auto bg-white dark:bg-gray-900 p-6'
    : '';

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800', fullscreenClasses)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-[#1F4E79]" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Tableau de bord
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Dashboard selector */}
          {dashboards.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {renderedDashboard?.title ?? 'Select'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
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
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300',
                      )}
                    >
                      {d.isDefault && <Star className="h-3 w-3 text-amber-500" />}
                      <span className="truncate">{d.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit button */}
          {activeDashboardId && (
            <Link
              href={`/dashboards/${activeDashboardId}/edit`}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title="Modifier le tableau de bord"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Set as default */}
          {activeDashboardId && activeDashboardId !== defaultDashboard?.id && (
            <button
              onClick={handleSetDefault}
              disabled={setPreference.isPending}
              className="rounded-md p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
              title="Definir comme tableau de bord par defaut"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
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
        ) : renderedDashboard && renderedDashboard.widgets.length > 0 ? (
          <DashboardGrid
            widgets={renderedDashboard.widgets}
            widgetData={widgetData}
            editable={false}
          />
        ) : (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
            <LayoutDashboard className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Aucun tableau de bord configure
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Creez un tableau de bord personnalise depuis &quot;Mes tableaux de bord&quot;
            </p>
            <Link
              href="/my-dashboards"
              className="mt-4 flex items-center gap-1 rounded-lg bg-[#1F4E79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a4060]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Creer un tableau de bord
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
