'use client';

import React, { useState, lazy, Suspense } from 'react';
import { MapPin, Navigation, Hexagon, Maximize2, Minimize2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const GeoPointMap = lazy(() => import('./GeoPointMap').then((m) => ({ default: m.GeoPointMap })));
const GeoPolygonMap = lazy(() => import('./GeoPolygonMap').then((m) => ({ default: m.GeoPolygonMap })));

type GeoMode = 'point' | 'line' | 'polygon';

interface GeoSelectorFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  modes?: GeoMode[];
  defaultMode?: GeoMode;
  /** Country code from admin-location to center the map */
  countryCode?: string;
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

// Country center coordinates for map positioning
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  DZ:[28.0,-2.0],AO:[-12.5,18.5],BJ:[9.3,2.3],BW:[-22.3,24.7],BF:[12.3,-1.5],BI:[-3.4,29.9],CV:[15.1,-23.6],CM:[5.9,12.8],CF:[6.6,20.9],TD:[15.4,18.7],KM:[-12.2,44.3],CG:[-0.2,15.8],CD:[-4.0,21.8],CI:[7.5,-5.5],DJ:[11.8,42.6],EG:[26.8,30.8],GQ:[1.6,10.3],ER:[15.2,39.8],SZ:[-26.5,31.5],ET:[9.0,38.7],GA:[-0.8,11.6],GM:[13.4,-15.4],GH:[7.9,-1.0],GN:[9.9,-11.4],GW:[12.0,-15.2],KE:[-0.02,37.9],LS:[-29.6,28.2],LR:[6.4,-9.4],LY:[26.3,17.2],MG:[-18.8,46.9],MW:[-13.3,34.3],ML:[17.6,-4.0],MR:[21.0,-10.9],MU:[-20.3,57.6],MA:[31.8,-7.1],MZ:[-18.7,35.5],NA:[-22.6,17.1],NE:[17.6,8.1],NG:[9.1,8.7],RW:[-1.9,29.9],ST:[0.2,6.6],SN:[14.5,-14.5],SC:[-4.7,55.5],SL:[8.5,-11.8],SO:[5.2,46.2],ZA:[-30.6,22.9],SS:[6.9,31.3],SD:[12.9,30.2],TZ:[-6.4,34.9],TG:[8.6,1.2],TN:[33.9,9.5],UG:[1.4,32.3],ZM:[-13.1,27.8],ZW:[-20.0,30.0],
};

export function GeoSelectorField({
  value,
  onChange,
  modes = ['point', 'line', 'polygon'],
  defaultMode = 'point',
  countryCode,
}: GeoSelectorFieldProps) {
  const [activeMode, setActiveMode] = useState<GeoMode>(defaultMode);
  const [expanded, setExpanded] = useState(false);

  const handleModeChange = (mode: GeoMode) => {
    setActiveMode(mode);
    onChange(null);
  };

  const [mapSize, setMapSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const mapHeightClass = expanded ? 'h-[80vh]' : mapSize === 'xlarge' ? 'h-[600px]' : mapSize === 'large' ? 'h-[450px]' : 'h-[350px]';

  return (
    <div className={cn('space-y-2', expanded && 'fixed inset-4 z-50 rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl dark:border-gray-600 dark:bg-gray-900')}>
      {/* Header with mode tabs + expand button */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
        {!expanded && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={mapSize === 'xlarge'}
              onClick={() => setMapSize((s) => s === 'normal' ? 'large' : 'xlarge')}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-700"
              title="Increase height"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={mapSize === 'normal'}
              onClick={() => setMapSize((s) => s === 'xlarge' ? 'large' : 'normal')}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-700"
              title="Decrease height"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          title={expanded ? 'Reduce' : 'Fullscreen'}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Map component */}
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
            mapClassName={expanded ? 'h-full' : mapHeightClass}
            className={expanded ? 'flex-1 min-h-0' : undefined}
            initialCenter={countryCode ? COUNTRY_CENTERS[countryCode] : undefined}
          />
        ) : (
          <GeoPolygonMap
            value={Array.isArray(value) ? (value as Array<[number, number]>) : null}
            onChange={(v) => onChange(v)}
            mode={activeMode}
            maxPoints={50}
            mapClassName={expanded ? 'h-full' : mapHeightClass}
            initialCenter={countryCode ? COUNTRY_CENTERS[countryCode] : undefined}
          />
        )}
      </Suspense>

      {/* Backdrop for expanded mode */}
      {expanded && (
        <div className="fixed inset-0 -z-10 bg-black/40" onClick={() => setExpanded(false)} />
      )}
    </div>
  );
}
