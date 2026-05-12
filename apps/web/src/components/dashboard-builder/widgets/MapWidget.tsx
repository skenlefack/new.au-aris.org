'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import type { MapContentProps } from './MapContent';

/* ── Loading skeleton shown while Leaflet JS loads ──────────────────────────── */

function MapSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 p-4 animate-pulse">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1F4E79]/10">
        <MapPin className="h-6 w-6 text-[#1F4E79]" />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label ?? 'Loading map...'}</p>
    </div>
  );
}

/* ── Dynamic import — Leaflet must NOT be server-side rendered ───────────── */

const MapContent = dynamic(() => import('./MapContent'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

/* ── Public widget interface ────────────────────────────────────────────────── */

interface MapWidgetProps {
  title?: string;
  config?: Record<string, unknown>;
  data?: MapContentProps['data'];
}

export function MapWidget({ title, config, data }: MapWidgetProps) {
  const t = useTranslations('dashboard');
  return (
    <div className="h-full w-full">
      <MapContent title={title} config={config} data={data} loadingLabel={t('dbLoadingMap')} />
    </div>
  );
}
