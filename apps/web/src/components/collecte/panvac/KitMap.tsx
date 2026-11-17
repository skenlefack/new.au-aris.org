'use client';

/**
 * Africa choropleth for the PANVAC dashboard: each country is shaded by the share of its requested
 * kits that were shipped (single-hue ramp, light = little shipped, dark = fully served). Countries
 * with no request stay grey. Tooltip gives the numbers behind the colour.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import { AFRICA_ISO2_SET, NUMERIC_TO_ISO2 } from '@/components/dashboard/maps/africa-geo-data';
import { cartoTileUrl } from '@/lib/map-tiles';

export interface KitMapDatum {
  code: string;
  name: string;
  requested: number;
  shipped: number;
  pending: number;
}

interface GeoFeature { type: 'Feature'; id?: string | number; properties: Record<string, any> | null; geometry: any }
interface GeoCollection { type: 'FeatureCollection'; features: GeoFeature[] }

let geoCache: Promise<GeoCollection | null> | null = null;
function loadAfrica(): Promise<GeoCollection | null> {
  if (!geoCache) {
    geoCache = fetch('/geo/countries-110m.json').then((r) => r.json()).then((topo: any) => {
      const world = feature(topo, topo.objects.countries) as unknown as GeoCollection;
      return {
        type: 'FeatureCollection' as const,
        features: world.features.filter((f) => {
          const iso2 = NUMERIC_TO_ISO2[String(f.id)];
          if (iso2 && AFRICA_ISO2_SET.has(iso2)) { f.properties = { ...f.properties, iso2 }; return true; }
          return false;
        }),
      };
    }).catch(() => null);
  }
  return geoCache;
}

const STEPS = [
  { min: 0, color: '#cde2fb' },
  { min: 0.25, color: '#86b6ef' },
  { min: 0.5, color: '#3987e5' },
  { min: 0.75, color: '#1c5cab' },
  { min: 1, color: '#0d366b' },
];
const NO_DATA = '#d4d3cc';

function colorFor(d: KitMapDatum | undefined): string {
  if (!d || d.requested <= 0) return NO_DATA;
  const r = d.shipped / d.requested;
  let c = STEPS[0].color;
  for (const s of STEPS) if (r >= s.min) c = s.color;
  return c;
}

export default function KitMap({ data, labels }: {
  data: KitMapDatum[];
  labels: { requested: string; shipped: string; pending: string; legend: string; none: string };
}) {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const ref = useRef<L.GeoJSON>(null);
  const byCode = new Map(data.map((d) => [d.code, d]));

  useEffect(() => { loadAfrica().then((g) => g && setGeo(g)); }, []);

  const style = useCallback((f?: GeoFeature) => {
    const d = byCode.get(f?.properties?.iso2);
    return { fillColor: colorFor(d), fillOpacity: d ? 0.85 : 0.45, color: '#ffffff', weight: 1, opacity: 0.9 };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const each = useCallback((f: GeoFeature, layer: L.Layer) => {
    const iso2 = f?.properties?.iso2 as string | undefined;
    const d = iso2 ? byCode.get(iso2) : undefined;
    const name = d?.name ?? f?.properties?.name ?? iso2;
    const body = d
      ? `<div>${labels.requested}: <b>${d.requested}</b></div><div>${labels.shipped}: <b>${d.shipped}</b>${d.requested ? ` (${Math.round((d.shipped / d.requested) * 100)}%)` : ''}</div>${d.pending ? `<div>${labels.pending}: <b>${d.pending}</b></div>` : ''}`
      : `<div style="color:#6b7280">${labels.none}</div>`;
    layer.bindTooltip(`<div style="font-size:12px;min-width:140px"><div style="font-weight:700;margin-bottom:4px">${name}</div>${body}</div>`, { direction: 'top', opacity: 0.95 });
    (layer as L.Path).on({
      mouseover: (e) => (e.target as L.Path).setStyle({ weight: 2.5 }),
      mouseout: (e) => ref.current?.resetStyle(e.target),
    });
  }, [data, labels]); // eslint-disable-line react-hooks/exhaustive-deps

  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tiles = cartoTileUrl(dark ? 'dark_nolabels' : 'light_nolabels');

  return (
    <div className="relative h-full w-full overflow-hidden rounded-b-xl">
      <MapContainer center={[2, 20]} zoom={3} minZoom={2} maxZoom={7} scrollWheelZoom={false} zoomControl attributionControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={tiles} />
        {geo && <GeoJSON ref={ref} key={data.map((d) => `${d.code}${d.shipped}${d.requested}`).join('|')} data={geo as any} style={style as any} onEachFeature={each as any} />}
      </MapContainer>
      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 px-3 py-2 shadow-md dark:bg-gray-900/95">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{labels.legend}</p>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.min} className="flex flex-col items-center">
              <span className="h-2.5 w-8" style={{ backgroundColor: s.color }} />
              <span className="mt-0.5 text-[10px] tabular-nums text-gray-600 dark:text-gray-300">{i === STEPS.length - 1 ? '100%' : `${s.min * 100}%`}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-300">
          <span className="h-2.5 w-3" style={{ backgroundColor: NO_DATA }} /> {labels.none}
        </div>
      </div>
    </div>
  );
}
