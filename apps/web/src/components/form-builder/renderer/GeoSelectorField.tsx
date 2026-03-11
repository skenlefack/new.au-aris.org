'use client';

import React, { useState, lazy, Suspense } from 'react';
import { MapPin, Navigation, Hexagon } from 'lucide-react';
import { cn } from '@/lib/utils';

const GeoPointMap = lazy(() => import('./GeoPointMap').then((m) => ({ default: m.GeoPointMap })));
const GeoPolygonMap = lazy(() => import('./GeoPolygonMap').then((m) => ({ default: m.GeoPolygonMap })));

type GeoMode = 'point' | 'line' | 'polygon';

interface GeoSelectorFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  modes?: GeoMode[];
  defaultMode?: GeoMode;
}

const MODE_CONFIG: Record<GeoMode, { label: string; icon: React.ElementType }> = {
  point: { label: 'Point', icon: Navigation },
  line: { label: 'Line', icon: MapPin },
  polygon: { label: 'Polygon', icon: Hexagon },
};

const MapFallback = (
  <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 animate-pulse">
    Loading map...
  </div>
);

export function GeoSelectorField({
  value,
  onChange,
  modes = ['point', 'line', 'polygon'],
  defaultMode = 'point',
}: GeoSelectorFieldProps) {
  const [activeMode, setActiveMode] = useState<GeoMode>(defaultMode);

  const handleModeChange = (mode: GeoMode) => {
    setActiveMode(mode);
    // Reset value when switching modes since data shapes differ
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {/* Mode selector tabs */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {modes.map((mode) => {
          const config = MODE_CONFIG[mode];
          const Icon = config.icon;
          const isActive = activeMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Map component based on active mode */}
      <Suspense fallback={MapFallback}>
        {activeMode === 'point' ? (
          <GeoPointMap
            value={
              value && typeof value === 'object' && 'lat' in (value as Record<string, unknown>)
                ? (value as { lat: number; lng: number })
                : null
            }
            onChange={(v) => onChange(v)}
            showManualEntry={true}
            autoDetect={true}
          />
        ) : (
          <GeoPolygonMap
            value={Array.isArray(value) ? (value as Array<[number, number]>) : null}
            onChange={(v) => onChange(v)}
            mode={activeMode}
            maxPoints={50}
          />
        )}
      </Suspense>
    </div>
  );
}
