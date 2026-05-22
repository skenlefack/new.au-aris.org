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

/** Green -> Yellow -> Red gradient. value in [0, max]. */
function valueToColor(value: number, max: number): string {
  if (max <= 0) return '#3b82f6'; // blue fallback
  const t = Math.min(value / max, 1);
  if (t <= 0.5) return lerpColor('#22c55e', '#eab308', t * 2);
  return lerpColor('#eab308', '#ef4444', (t - 0.5) * 2);
}

/** Radius proportional to value, clamped. */
function valueToRadius(value: number, max: number): number {
  if (max <= 0) return 5;
  const t = Math.min(value / max, 1);
  return 5 + t * 19; // 5..24
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

/* ── Legend ──────────────────────────────────────────────────────────────────── */

function Legend({ max, unit, valueLabel }: { max: number; unit?: string; valueLabel: string }) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div
      className="absolute bottom-3 right-3 z-[1000] rounded-md bg-white/90 px-2.5 py-2 text-[10px] shadow-md backdrop-blur dark:bg-gray-900/90 dark:text-gray-200"
    >
      <div className="mb-1 font-medium">
        {valueLabel}{unit ? ` (${unit})` : ''}
      </div>
      <div className="flex items-center gap-0.5">
        {stops.map((s, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="h-2.5 w-5 rounded-[2px]"
              style={{ backgroundColor: valueToColor(s * max, max) }}
            />
            <span className="mt-0.5">{Math.round(s * max)}</span>
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

  // Build lookup: countryCode -> datum
  const { lookup, maxValue, hasData } = useMemo(() => {
    const map = new Map<string, MapCountryDatum>();
    let mx = 0;
    if (data?.byCountry && data.byCountry.length > 0) {
      for (const d of data.byCountry) {
        map.set(d.countryCode.toUpperCase(), d);
        if (d.value > mx) mx = d.value;
      }
    }
    return { lookup: map, maxValue: mx, hasData: map.size > 0 };
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

          // Determine visual style
          const fillColor = hasData
            ? datum
              ? valueToColor(value, maxValue)
              : '#d1d5db' // gray for no-data countries
            : REC_COLORS[country.rec] ?? '#94a3b8';

          const radius = hasData
            ? datum
              ? valueToRadius(value, maxValue)
              : 4
            : 6;

          const fillOpacity = hasData ? (datum ? 0.8 : 0.3) : 0.6;

          return (
            <CircleMarker
              key={country.code}
              center={[country.lat, country.lng]}
              radius={radius}
              pathOptions={{
                fillColor,
                fillOpacity,
                color: '#fff',
                weight: 1.5,
                opacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                <div className="text-xs">
                  <div className="font-semibold">{country.name}</div>
                  {hasData && datum && (
                    <>
                      <div className="text-gray-600 dark:text-gray-300">
                        {datum.label ?? t('dbValue')}: <strong>{value.toLocaleString()}</strong>
                        {unit ? ` ${unit}` : ''}
                      </div>
                      {datum.extras && Object.entries(datum.extras).map(([k, v]) => (
                        <div key={k} className="text-gray-600 dark:text-gray-300">
                          {k}: <strong>{typeof v === 'number' ? v.toLocaleString() : v}</strong>
                        </div>
                      ))}
                    </>
                  )}
                  {hasData && !datum && (
                    <div className="text-gray-400 italic">{t('dbNoData')}</div>
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

      {/* Legend — only when there is data */}
      {hasData && <Legend max={maxValue} unit={unit} valueLabel={t('dbValue')} />}

      {/* Title overlay (top-left) */}
      {title && (
        <div className="absolute left-3 top-3 z-[1000] rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-gray-700 shadow backdrop-blur dark:bg-gray-900/80 dark:text-gray-200">
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
