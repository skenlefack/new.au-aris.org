'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import {
  AFRICA_ISO2_SET,
  NUMERIC_TO_ISO2,
  AFRICA_COUNTRY_MAP,
} from '@/components/dashboard/maps/africa-geo-data';

type DigitalStatus = 'uses_digital' | 'no_digital' | 'not_surveyed';

interface CountryStatus {
  code: string;
  name: string;
  nameFr: string;
  lat: number;
  lng: number;
  rec: string;
  status: DigitalStatus;
}

interface Props {
  countries: CountryStatus[];
  statusColors: Record<DigitalStatus, string>;
  statusLabels: Record<DigitalStatus, string>;
}

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

const WORLD_ATLAS_URL = '/geo/countries-110m.json';

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

export default function DigitalToolsMap({ countries, statusColors, statusLabels }: Props) {
  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(null);
  const geoRef = useRef<L.GeoJSON>(null);

  // Build lookup: ISO2 → status
  const statusMap = new Map<string, DigitalStatus>();
  const countryInfoMap = new Map<string, CountryStatus>();
  for (const c of countries) {
    statusMap.set(c.code, c.status);
    countryInfoMap.set(c.code, c);
  }

  const counts: Record<DigitalStatus, number> = { uses_digital: 0, no_digital: 0, not_surveyed: 0 };
  for (const c of countries) counts[c.status]++;

  useEffect(() => {
    loadAfricaGeo().then((geo) => {
      if (geo) setGeoData(geo);
    });
  }, []);

  const styleFn = useCallback(
    (feat?: GeoFeature) => {
      const iso2 = feat?.properties?.iso2 as string | undefined;
      const status = iso2 ? (statusMap.get(iso2) ?? 'not_surveyed') : 'not_surveyed';
      const color = statusColors[status];
      const opacity = status === 'not_surveyed' ? 0.3 : 0.75;
      return {
        fillColor: color,
        fillOpacity: opacity,
        color: '#fff',
        weight: 1,
        opacity: 0.9,
      };
    },
    [statusMap, statusColors],
  );

  const onEachFeature = useCallback(
    (feat: GeoFeature, layer: L.Layer) => {
      const iso2 = feat?.properties?.iso2 as string | undefined;
      if (!iso2) return;

      const status = statusMap.get(iso2) ?? 'not_surveyed';
      const info = countryInfoMap.get(iso2);
      const countryMeta = AFRICA_COUNTRY_MAP.get(iso2);
      const name = info?.nameFr || countryMeta?.nameFr || countryMeta?.name || iso2;
      const color = statusColors[status];
      const label = statusLabels[status];

      layer.bindTooltip(
        `<div style="font-size:12px;min-width:150px">
          <div style="font-weight:700;margin-bottom:4px">${name}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
            <span style="color:#4B5563">${label}</span>
          </div>
        </div>`,
        { direction: 'top', opacity: 0.95 },
      );

      // Hover highlight
      (layer as L.Path).on({
        mouseover: (e) => {
          (e.target as L.Path).setStyle({
            weight: 2.5,
            fillOpacity: status === 'not_surveyed' ? 0.5 : 0.9,
          });
        },
        mouseout: (e) => {
          if (geoRef.current) geoRef.current.resetStyle(e.target);
        },
      });
    },
    [statusMap, countryInfoMap, statusColors, statusLabels],
  );

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-b-xl">
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

        {geoData && (
          <GeoJSON
            ref={geoRef}
            key={countries.length}
            data={geoData as any}
            style={styleFn as any}
            onEachFeature={onEachFeature as any}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 px-3 py-2.5 shadow-md backdrop-blur dark:bg-gray-900/95">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Statut</p>
        {(['uses_digital', 'no_digital', 'not_surveyed'] as DigitalStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-2 py-0.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: statusColors[s], opacity: s === 'not_surveyed' ? 0.4 : 1 }}
            />
            <span className="text-[11px] text-gray-600 dark:text-gray-300">
              {statusLabels[s]} ({counts[s]})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
