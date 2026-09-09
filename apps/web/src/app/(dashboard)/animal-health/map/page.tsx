'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import type { OutbreakMarker } from '@/components/maps/AfricaMap';
import { useOutbreakMarkers } from '@/lib/api/hooks';
import { MapSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

const AfricaMap = dynamic(
  () =>
    import('@/components/maps/AfricaMap').then((mod) => mod.AfricaMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export default function OutbreakMapPage() {
  const t = useTranslations('animalHealth');
  const { data, isLoading, isError, error, refetch } = useOutbreakMarkers();
  const markers: OutbreakMarker[] = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/animal-health"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('outbreakMap')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('outbreakMapSubtitle')}
            </p>
          </div>
        </div>
        <Link
          href="/animal-health"
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <List className="h-4 w-4" />
          {t('listView')}
        </Link>
      </div>

      {isError ? (
        <QueryError
          message={error instanceof Error ? error.message : t('loadError')}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <AfricaMap
            markers={markers}
            height="600px"
            onMarkerClick={(m) => {
              window.location.href = `/animal-health/events/${m.id}`;
            }}
          />
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              {markers.length} {t('events')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />
              {t('low')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F57F17]" />
              {t('medium')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E65100]" />
              {t('high')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C62828]" />
              {t('critical')}
            </span>
          </div>

          {/* Stats summary */}
          {isLoading ? null : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-card border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-400">{t('totalEvents')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {markers.length}
                </p>
              </div>
              <div className="rounded-card border border-red-200 bg-red-50 p-4">
                <p className="text-xs text-red-600">{t('critical')}</p>
                <p className="text-xl font-bold text-red-700">
                  {markers.filter((m) => m.severity === 'critical').length}
                </p>
              </div>
              <div className="rounded-card border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs text-orange-600">{t('high')}</p>
                <p className="text-xl font-bold text-orange-700">
                  {markers.filter((m) => m.severity === 'high').length}
                </p>
              </div>
              <div className="rounded-card border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-400">{t('cases')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {markers.reduce((sum, m) => sum + m.cases, 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
