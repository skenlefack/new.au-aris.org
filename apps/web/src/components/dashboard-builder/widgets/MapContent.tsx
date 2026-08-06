'use client';

import React, { useMemo } from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AFRICA_COUNTRIES,
  type AfricaCountryGeo,
} from '@/components/dashboard/maps/africa-geo-data';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface MapCountryDatum {
  countryCode: string;
  value: number;
  label?: string;
  /** 'allocated' | 'requested' | undefined — drives 3-color logic */
  status?: string;
  /** Additional key-value pairs shown in the tooltip (e.g. samples, year) */
  extras?: Record<string, string | number>;
}

export interface MapContentProps {
  data?: { byCountry?: MapCountryDatum[] };
  config?: Record<string, unknown>;
  title?: string;
  loadingLabel?: string;
}

/* ── Color helpers ──────────────────────────────────────────────────────────── */

/** Interpolate between two hex colors. t in [0,1]. */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const;
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(r1 + (r2 - r1) * t);
  const g = clamp(g1 + (g2 - g1) * t);
  const bl = clamp(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Green gradient for allocated countries: light green → dark green */
function allocatedColor(value: number, max: number): string {
  if (max <= 0) return '#22c55e';
  const t = Math.min(value / max, 1);
  return lerpColor('#86efac', '#15803d', t); // green-300 → green-700
}

/** Radius proportional to value, clamped. */
function valueToRadius(value: number, max: number): number {
  if (max <= 0) return 6;
  const t = Math.min(value / max, 1);
  return 7 + t * 17; // 7..24
}

/* ── REC color palette (fallback when no data) ──────────────────────────────── */

const REC_COLORS: Record<string, string> = {
  ecowas: '#3b82f6',
  eccas: '#8b5cf6',
  igad: '#f59e0b',
  eac: '#10b981',
  sadc: '#06b6d4',
  uma: '#ef4444',
  comesa: '#ec4899',
  censad: '#6366f1',
};

/* ── Category Legend ───────────────────────────────────────────────────────── */

function CategoryLegend({ hasRequested }: { hasRequested: boolean }) {
  const items = [
    { color: '#22c55e', border: '#16a34a', label: 'Kits alloues' },
    ...(hasRequested ? [{ color: '#9ca3af', border: '#6b7280', label: 'Demande sans allocation' }] : []),
    { color: '#f3f4f6', border: '#d1d5db', label: 'Pas de demande' },
  ];

  return (
    <div className="absolute bottom-3 right-3 z-[1000] rounded-lg bg-white/95 px-3 py-2.5 shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:bg-gray-900/95 dark:ring-white/10">
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color, border: `1.5px solid ${item.border}` }}
            />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

export default function MapContent({ data, config, title }: MapContentProps) {
  const t = useTranslations('dashboard');
  const unit = (config?.unit as string) ?? '';

  // Build lookups
  const { lookup, maxValue, hasData, hasRequested } = useMemo(() => {
    const map = new Map<string, MapCountryDatum>();
    let mx = 0;
    let hasReq = false;
    if (data?.byCountry && data.byCountry.length > 0) {
      for (const d of data.byCountry) {
        map.set(d.countryCode.toUpperCase(), d);
        if (d.value > mx) mx = d.value;
        if (d.status === 'requested') hasReq = true;
      }
    }
    return { lookup: map, maxValue: mx, hasData: map.size > 0, hasRequested: hasReq };
  }, [data]);

  // Determine dark mode from document class
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <MapContainer
        center={[2, 20]}
        zoom={3}
        minZoom={2}
        maxZoom={7}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tileUrl} />

        {AFRICA_COUNTRIES.map((country: AfricaCountryGeo) => {
          const datum = lookup.get(country.code);
          const value = datum?.value ?? 0;
          const status = datum?.status;

          // 3 categories:
          // 1. Allocated (value > 0 or status === 'allocated') → green gradient
          // 2. Requested but no allocation (status === 'requested', value === 0) → gray
          // 3. No data → white/light (no demand)
          let fillColor: string;
          let radius: number;
          let fillOpacity: number;
          let strokeColor: string;
          let strokeWeight: number;

          if (hasData) {
            if (datum && (value > 0 || status === 'allocated')) {
              // Allocated — green with size proportional to value
              fillColor = allocatedColor(value, maxValue);
              radius = valueToRadius(value, maxValue);
              fillOpacity = 0.85;
              strokeColor = '#15803d';
              strokeWeight = 2;
            } else if (datum && status === 'requested') {
              // Requested but no allocation — gray
              fillColor = '#9ca3af';
              radius = 8;
              fillOpacity = 0.7;
              strokeColor = '#6b7280';
              strokeWeight = 1.5;
            } else {
              // No demand, no kits — white/very light
              fillColor = isDark ? '#374151' : '#f3f4f6';
              radius = 5;
              fillOpacity = 0.5;
              strokeColor = isDark ? '#4b5563' : '#d1d5db';
              strokeWeight = 1;
            }
          } else {
            // No data at all — show REC colors
            fillColor = REC_COLORS[country.rec] ?? '#94a3b8';
            radius = 6;
            fillOpacity = 0.6;
            strokeColor = '#fff';
            strokeWeight = 1.5;
          }

          return (
            <CircleMarker
              key={country.code}
              center={[country.lat, country.lng]}
              radius={radius}
              pathOptions={{
                fillColor,
                fillOpacity,
                color: strokeColor,
                weight: strokeWeight,
                opacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]} opacity={0.97}>
                <div className="text-xs min-w-[140px]">
                  <div className="font-bold text-[13px] mb-1">{country.name}</div>
                  {hasData && datum && value > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500">{datum.label ?? 'Kits'}</span>
                        <span className="font-bold text-[13px] text-green-600">
                          {value.toLocaleString()}
                          {unit ? ` ${unit}` : ''}
                        </span>
                      </div>
                      {datum.extras && Object.entries(datum.extras).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-3 text-gray-500">
                          <span>{k}</span>
                          <span className="font-semibold tabular-nums">{typeof v === 'number' ? v.toLocaleString() : v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasData && datum && status === 'requested' && value === 0 && (
                    <div className="text-gray-500 text-[11px]">
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1" />
                      Demande sans allocation
                      {datum.extras && Object.entries(datum.extras).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-3 mt-0.5">
                          <span>{k}</span>
                          <span className="font-semibold tabular-nums">{typeof v === 'number' ? v.toLocaleString() : v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasData && !datum && (
                    <div className="text-gray-400 italic text-[10px]">Pas de demande</div>
                  )}
                  {!hasData && (
                    <div className="text-gray-500">
                      {t('dbRec')} {country.rec.toUpperCase()}
                    </div>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Category legend */}
      {hasData && <CategoryLegend hasRequested={hasRequested} />}

      {/* Title overlay (top-left) */}
      {title && (
        <div className="absolute left-3 top-3 z-[1000] rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-gray-700 shadow-md backdrop-blur-sm dark:bg-gray-900/90 dark:text-gray-200">
          {title}
        </div>
      )}

      {/* Fallback label when no data */}
      {!hasData && (
        <div className="absolute bottom-3 left-3 z-[1000] rounded-md bg-white/80 px-2 py-1 text-[10px] text-gray-500 shadow backdrop-blur dark:bg-gray-900/80 dark:text-gray-400">
          {t('dbShowingMemberStatesByRec')}
        </div>
      )}
    </div>
  );
}
