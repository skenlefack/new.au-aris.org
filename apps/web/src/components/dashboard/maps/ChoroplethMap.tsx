'use client';

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import {
  AFRICA_COUNTRIES,
  AFRICA_COUNTRY_MAP,
  AFRICA_ISO2_SET,
  NUMERIC_TO_ISO2,
  getOutbreakColor,
} from './africa-geo-data';
import type { CountryOutbreakData } from '../demo-data';
import { WidgetWrapper } from '../widgets/WidgetWrapper';

/* ── GeoJSON types (inline) ─────────────────────────────────────────────────── */

interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, any> | null;
  geometry: any;
}
interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

// Local — no external CDN dependency
const WORLD_ATLAS_URL = '/geo/countries-110m.json';

const AFRICA_CENTER: L.LatLngExpression = [2, 20];
const AFRICA_ZOOM = 3;

/* ── Props ──────────────────────────────────────────────────────────────────── */

interface ChoroplethMapProps {
  title: string;
  subtitle?: string;
  data: CountryOutbreakData[];
  indicator?: 'outbreaks' | 'cases' | 'vaccinations' | 'submissions';
  onCountryClick?: (code: string) => void;
  height?: string;
  demo?: boolean;
  bare?: boolean;
  selectedRec?: string;
  selectedCountry?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  COUNTRY-LEVEL GeoJSON (world-atlas TopoJSON)                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

let geoCache: GeoFeatureCollection | null = null;
let geoCachePromise: Promise<GeoFeatureCollection | null> | null = null;

function loadAfricaGeo(): Promise<GeoFeatureCollection | null> {
  if (geoCache) return Promise.resolve(geoCache);
  if (geoCachePromise) return geoCachePromise;

  geoCachePromise = fetch(WORLD_ATLAS_URL)
    .then((r) => r.json())
    .then((topo: any) => {
      const world = feature(topo, topo.objects.countries) as unknown as GeoFeatureCollection;
      const africaFeatures = world.features.filter((f) => {
        const iso2 = NUMERIC_TO_ISO2[String(f.id)];
        if (iso2 && AFRICA_ISO2_SET.has(iso2)) {
          f.properties = { ...f.properties, iso2 };
          return true;
        }
        return false;
      });
      geoCache = { type: 'FeatureCollection', features: africaFeatures };
      return geoCache;
    })
    .catch(() => null);

  return geoCachePromise;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ADMIN1 GeoJSON — cascading sources (GADM → geoBoundaries API)            */
/* ═══════════════════════════════════════════════════════════════════════════ */

const admin1Cache = new Map<string, GeoFeatureCollection>();

async function loadCountryAdmin1(code3: string): Promise<GeoFeatureCollection | null> {
  if (admin1Cache.has(code3)) return admin1Cache.get(code3)!;

  function normalize(data: any, nameKey: string): GeoFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: (data.features ?? []).map((f: any) => ({
        ...f,
        properties: { ...f.properties, shapeName: f.properties?.[nameKey] ?? '' },
      })),
    };
  }

  // Source 1: Local file (bundled in public/geo/admin1/)
  try {
    const localUrl = `/geo/admin1/${code3}.json`;
    const res = await fetch(localUrl);
    if (res.ok) {
      const data = await res.json();
      const fc = normalize(data, 'NAME_1');
      if (fc.features.length > 0) {
        admin1Cache.set(code3, fc);
        return fc;
      }
    }
  } catch { /* continue to remote fallback */ }

  // Source 2 (fallback): GADM remote — only if local file missing
  try {
    const gadmUrl = `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${code3}_1.json`;
    const res = await fetch(gadmUrl);
    if (res.ok) {
      const data = await res.json();
      const fc = normalize(data, 'NAME_1');
      if (fc.features.length > 0) {
        admin1Cache.set(code3, fc);
        return fc;
      }
    }
  } catch { /* both sources failed */ }

  return null;
}

/* ── Admin1 color scale (by cases) ──────────────────────────────────────── */

function getAdmin1Color(cases: number): string {
  if (cases === 0) return '#f3f4f6';
  if (cases <= 50) return '#d1fae5';
  if (cases <= 100) return '#fef3c7';
  if (cases <= 200) return '#fed7aa';
  if (cases <= 300) return '#fca5a5';
  if (cases <= 400) return '#f87171';
  return '#dc2626';
}

const ADMIN1_LEGEND = [
  { label: '0', color: '#f3f4f6' },
  { label: '1–50', color: '#d1fae5' },
  { label: '51–100', color: '#fef3c7' },
  { label: '101–200', color: '#fed7aa' },
  { label: '201–300', color: '#fca5a5' },
  { label: '301–400', color: '#f87171' },
  { label: '400+', color: '#dc2626' },
];

/* ── Deterministic hash for region name ──────────────────────────────────── */

function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Compute outbreak/case values for an admin1 feature.
 * Uses deterministic pseudo-random distribution proportional to country totals.
 */
function getAdmin1Values(
  shapeName: string,
  countryData: CountryOutbreakData | undefined,
  totalFeatures: number,
): { outbreaks: number; cases: number } {
  if (!countryData || totalFeatures === 0) return { outbreaks: 0, cases: 0 };

  const h = strHash(shapeName);
  // Weight between 0.15 and 1.4 — creates variance across regions
  const weight = 0.15 + (h % 125) / 100;
  const avgCases = countryData.cases / totalFeatures;
  const avgOutbreaks = countryData.outbreaks / totalFeatures;

  return {
    outbreaks: Math.max(0, Math.round(avgOutbreaks * weight)),
    cases: Math.max(0, Math.round(avgCases * weight)),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  AutoZoom                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function AutoZoom({
  selectedRec,
  selectedCountry,
  geoData,
  admin1Data,
}: {
  selectedRec?: string;
  selectedCountry?: string;
  geoData: GeoFeatureCollection | null;
  admin1Data: GeoFeatureCollection | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Country selected → zoom to admin1 bounds or country polygon
    if (selectedCountry && selectedCountry !== 'all') {
      if (admin1Data && admin1Data.features.length > 0) {
        const layer = L.geoJSON(admin1Data as any);
        map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 8 });
        return;
      }
      if (geoData) {
        const feat = geoData.features.find(
          (f) => f.properties?.iso2 === selectedCountry,
        );
        if (feat) {
          const layer = L.geoJSON(feat);
          map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 7 });
          return;
        }
      }
    }

    // REC selected → zoom to REC region
    if (selectedRec && selectedRec !== 'all' && geoData) {
      const recCodes = new Set(
        AFRICA_COUNTRIES.filter((c) => c.rec === selectedRec).map((c) => c.code),
      );
      const recFeatures = geoData.features.filter((f) =>
        recCodes.has(f.properties?.iso2),
      );
      if (recFeatures.length > 0) {
        const layer = L.geoJSON({
          type: 'FeatureCollection',
          features: recFeatures,
        } as any);
        map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 6 });
        return;
      }
    }

    // Default → all Africa
    map.setView(AFRICA_CENTER, AFRICA_ZOOM);
  }, [map, selectedRec, selectedCountry, geoData, admin1Data]);

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Country-level ChoroplethLayer                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ChoroplethLayer({
  geoData,
  dataMap,
  indicator,
  onCountryClick,
  dimmed,
}: {
  geoData: GeoFeatureCollection;
  dataMap: Map<string, CountryOutbreakData>;
  indicator: string;
  onCountryClick?: (code: string) => void;
  dimmed?: boolean;
}) {
  const geoRef = useRef<L.GeoJSON>(null);

  const styleFn = useCallback(
    (feat?: GeoFeature) => {
      const iso2 = feat?.properties?.iso2 as string | undefined;
      const d = iso2 ? dataMap.get(iso2) : undefined;
      const raw = d?.[indicator as keyof CountryOutbreakData] ?? 0;
      const v = typeof raw === 'number' ? raw : 0;
      const color = getOutbreakColor(
        indicator === 'outbreaks' ? v : Math.round(v / 100),
      );
      return {
        fillColor: dimmed ? '#e2e8f0' : color,
        fillOpacity: dimmed ? 0.4 : 0.82,
        color: '#fff',
        weight: dimmed ? 0.5 : 1,
        opacity: dimmed ? 0.5 : 0.9,
      };
    },
    [dataMap, indicator, dimmed],
  );

  const onEachFeature = useCallback(
    (feat: GeoFeature, layer: L.Layer) => {
      if (dimmed) return; // No interaction when dimmed

      const iso2 = feat.properties?.iso2 as string | undefined;
      const geo = iso2 ? AFRICA_COUNTRY_MAP.get(iso2) : undefined;
      const d = iso2 ? dataMap.get(iso2) : undefined;
      const name = geo?.name ?? feat.properties?.name ?? 'Unknown';

      let html = `<div style="font-size:12px;min-width:150px">`;
      html += `<div style="font-weight:600;margin-bottom:4px">${name}</div>`;
      if (d) {
        html += `<table style="width:100%;font-size:11px;color:#555">`;
        html += `<tr><td>Outbreaks</td><td style="text-align:right;font-weight:600;color:#111">${d.outbreaks}</td></tr>`;
        html += `<tr><td>Cases</td><td style="text-align:right;font-weight:500">${d.cases.toLocaleString()}</td></tr>`;
        html += `<tr><td>Deaths</td><td style="text-align:right;font-weight:500;color:#dc2626">${d.deaths.toLocaleString()}</td></tr>`;
        html += `<tr><td>Vaccinations</td><td style="text-align:right;font-weight:500">${d.vaccinations.toLocaleString()}</td></tr>`;
        html += `<tr><td>Submissions</td><td style="text-align:right;font-weight:500">${d.submissions}</td></tr>`;
        html += `</table>`;
      } else {
        html += `<div style="color:#aaa">No data reported</div>`;
      }
      html += `</div>`;

      layer.bindTooltip(html, { sticky: true, direction: 'auto', opacity: 0.95 });

      layer.on({
        mouseover: (e) => {
          const target = e.target as L.Path;
          target.setStyle({ weight: 2.5, color: '#334155', fillOpacity: 0.95 });
          target.bringToFront();
        },
        mouseout: (e) => {
          geoRef.current?.resetStyle(e.target);
        },
        click: () => {
          if (iso2 && onCountryClick) onCountryClick(iso2);
        },
      });
    },
    [dataMap, onCountryClick, dimmed],
  );

  const key = useMemo(
    () => `${indicator}-${dimmed ? 'd' : 'n'}-${[...dataMap.keys()].sort().join(',')}`,
    [dataMap, indicator, dimmed],
  );

  return (
    <GeoJSON
      key={key}
      ref={geoRef}
      data={geoData}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Admin1 Layer                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function Admin1Layer({
  admin1Data,
  countryCode,
  countryData,
}: {
  admin1Data: GeoFeatureCollection;
  countryCode: string;
  countryData: CountryOutbreakData | undefined;
}) {
  const geoRef = useRef<L.GeoJSON>(null);
  const totalFeatures = admin1Data.features.length;

  const styleFn = useCallback(
    (feat?: GeoFeature) => {
      const shapeName = feat?.properties?.shapeName ?? '';
      const vals = getAdmin1Values(shapeName, countryData, totalFeatures);
      return {
        fillColor: getAdmin1Color(vals.cases),
        fillOpacity: 0.82,
        color: '#fff',
        weight: 1.5,
        opacity: 1,
      };
    },
    [countryData, totalFeatures],
  );

  const onEachFeature = useCallback(
    (feat: GeoFeature, layer: L.Layer) => {
      const shapeName = feat.properties?.shapeName ?? 'Unknown';
      const vals = getAdmin1Values(shapeName, countryData, totalFeatures);

      let html = `<div style="font-size:12px;min-width:140px">`;
      html += `<div style="font-weight:600;margin-bottom:4px">${shapeName}</div>`;
      if (vals.cases > 0 || vals.outbreaks > 0) {
        html += `<table style="width:100%;font-size:11px;color:#555">`;
        html += `<tr><td>Outbreaks</td><td style="text-align:right;font-weight:600;color:#111">${vals.outbreaks}</td></tr>`;
        html += `<tr><td>Cases</td><td style="text-align:right;font-weight:500">${vals.cases.toLocaleString()}</td></tr>`;
        html += `</table>`;
      } else {
        html += `<div style="color:#aaa">No data available</div>`;
      }
      html += `</div>`;

      layer.bindTooltip(html, { sticky: true, direction: 'auto', opacity: 0.95 });

      layer.on({
        mouseover: (e) => {
          const target = e.target as L.Path;
          target.setStyle({ weight: 3, color: '#1e293b', fillOpacity: 0.95 });
          target.bringToFront();
        },
        mouseout: (e) => {
          geoRef.current?.resetStyle(e.target);
        },
      });
    },
    [countryData, totalFeatures],
  );

  return (
    <GeoJSON
      key={`admin1-${countryCode}-${totalFeatures}`}
      ref={geoRef}
      data={admin1Data}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Floating Legend (inside the map)                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

function MapLegend({ items, label }: { items: { label: string; color: string }[]; label: string }) {
  return (
    <div
      className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur px-3 py-2 shadow-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="text-[9px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">
        {label}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-5 rounded-sm border border-gray-300/50"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-gray-600 dark:text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ChoroplethMap({
  title,
  subtitle,
  data,
  indicator = 'outbreaks',
  onCountryClick,
  height = '460px',
  demo,
  bare,
  selectedRec,
  selectedCountry,
}: ChoroplethMapProps) {
  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(geoCache);
  const [admin1Data, setAdmin1Data] = useState<GeoFeatureCollection | null>(null);
  const [admin1Loading, setAdmin1Loading] = useState(false);

  // Load country-level GeoJSON
  useEffect(() => {
    if (geoCache) {
      setGeoData(geoCache);
      return;
    }
    let cancelled = false;
    loadAfricaGeo().then((g) => {
      if (!cancelled) setGeoData(g);
    });
    return () => { cancelled = true; };
  }, []);

  // Load Admin1 GeoJSON when a country is selected
  useEffect(() => {
    if (!selectedCountry || selectedCountry === 'all') {
      setAdmin1Data(null);
      return;
    }

    const geo = AFRICA_COUNTRY_MAP.get(selectedCountry);
    if (!geo) {
      setAdmin1Data(null);
      return;
    }

    setAdmin1Loading(true);
    let cancelled = false;

    loadCountryAdmin1(geo.code3).then((fc) => {
      if (!cancelled) {
        setAdmin1Data(fc);
        setAdmin1Loading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedCountry]);

  const isCountrySelected = selectedCountry && selectedCountry !== 'all';
  const showAdmin1 = isCountrySelected && admin1Data && admin1Data.features.length > 0;

  const dataMap = useMemo(() => {
    const m = new Map<string, CountryOutbreakData>();
    data.forEach((d) => m.set(d.code, d));
    return m;
  }, [data]);

  const countryName = isCountrySelected
    ? AFRICA_COUNTRY_MAP.get(selectedCountry!)?.name ?? selectedCountry
    : '';

  const mapContent = (
    <MapContainer
      center={AFRICA_CENTER}
      zoom={AFRICA_ZOOM}
      style={{ height: '100%', width: '100%' }}
      zoomControl={!bare}
      scrollWheelZoom={true}
      className={bare ? '' : 'rounded-b-xl'}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
      />

      <AutoZoom
        selectedRec={selectedRec}
        selectedCountry={selectedCountry}
        geoData={geoData}
        admin1Data={admin1Data}
      />

      {/* Country-level layer (dimmed when showing admin1) */}
      {geoData && (
        <ChoroplethLayer
          geoData={geoData}
          dataMap={dataMap}
          indicator={indicator}
          onCountryClick={onCountryClick}
          dimmed={!!showAdmin1}
        />
      )}

      {/* Admin1 layer (on top) */}
      {showAdmin1 && (
        <Admin1Layer
          admin1Data={admin1Data!}
          countryCode={selectedCountry!}
          countryData={dataMap.get(selectedCountry!)}
        />
      )}

      {/* Labels on top */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
      />
    </MapContainer>
  );

  /* Bare mode */
  if (bare) {
    return (
      <div className="h-full w-full relative">
        {mapContent}

        {/* Loading indicator */}
        {admin1Loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/40 dark:bg-gray-900/40 backdrop-blur-[2px]">
            <div className="rounded-lg bg-white dark:bg-gray-800 px-4 py-2 shadow text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading {countryName} regions…
            </div>
          </div>
        )}

        {/* Floating legend */}
        {showAdmin1 ? (
          <MapLegend items={ADMIN1_LEGEND} label={`${countryName} — Cases`} />
        ) : (
          <MapLegend
            items={[
              { label: '0', color: '#e5e7eb' },
              { label: '1–5', color: '#dcfce7' },
              { label: '6–15', color: '#fef3c7' },
              { label: '16–30', color: '#fed7aa' },
              { label: '31–50', color: '#fca5a5' },
              { label: '51–75', color: '#ef4444' },
              { label: '75+', color: '#991b1b' },
            ]}
            label="Outbreaks"
          />
        )}
      </div>
    );
  }

  return (
    <WidgetWrapper title={title} subtitle={subtitle} demo={demo} noPadding>
      <div style={{ height }} className="relative">
        {mapContent}

        {admin1Loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/40 dark:bg-gray-900/40">
            <div className="rounded-lg bg-white dark:bg-gray-800 px-4 py-2 shadow text-xs text-gray-600 dark:text-gray-300">
              Loading {countryName} regions…
            </div>
          </div>
        )}

        {showAdmin1 && (
          <MapLegend items={ADMIN1_LEGEND} label={`${countryName} — Cases`} />
        )}
      </div>

      {/* Bottom legend (only for country-level view) */}
      {!showAdmin1 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/50 text-[10px] text-gray-500">
          <span className="font-medium text-gray-600 dark:text-gray-400">Outbreaks:</span>
          {[
            { label: '0', color: '#e5e7eb' },
            { label: '1–5', color: '#dcfce7' },
            { label: '6–15', color: '#fef3c7' },
            { label: '16–30', color: '#fed7aa' },
            { label: '31–50', color: '#fca5a5' },
            { label: '51–75', color: '#ef4444' },
            { label: '75+', color: '#991b1b' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
