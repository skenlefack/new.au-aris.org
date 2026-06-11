'use client';

import React from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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

const STATUS_RADIUS: Record<DigitalStatus, number> = {
  uses_digital: 10,
  no_digital: 8,
  not_surveyed: 5,
};

export default function DigitalToolsMap({ countries, statusColors, statusLabels }: Props) {
  const counts: Record<DigitalStatus, number> = { uses_digital: 0, no_digital: 0, not_surveyed: 0 };
  for (const c of countries) counts[c.status]++;

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

        {countries.map((c) => {
          const color = statusColors[c.status];
          const radius = STATUS_RADIUS[c.status];
          const opacity = c.status === 'not_surveyed' ? 0.35 : 0.85;

          return (
            <CircleMarker
              key={c.code}
              center={[c.lat, c.lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                fillOpacity: opacity,
                color: '#fff',
                weight: 1.5,
                opacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                <div className="text-xs min-w-[140px]">
                  <div className="font-semibold text-gray-800">{c.nameFr || c.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-gray-600">{statusLabels[c.status]}</span>
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 px-3 py-2.5 shadow-md backdrop-blur dark:bg-gray-900/95">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Statut</p>
        {(['uses_digital', 'no_digital', 'not_surveyed'] as DigitalStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-2 py-0.5">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColors[s] }} />
            <span className="text-[11px] text-gray-600 dark:text-gray-300">
              {statusLabels[s]} ({counts[s]})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
