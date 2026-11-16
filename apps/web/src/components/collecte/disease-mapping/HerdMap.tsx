'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  /** Larger herds get slightly larger dots (radius 4..9). */
  weight: number;
  title: string;
  lines: string[];
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.length ? `${points.length}:${points[0].id}:${points[points.length - 1].id}` : '';
  useEffect(() => {
    if (points.length === 0) return;
    // Frame the bulk of the herds: a few wrong GPS fixes far away must not zoom out to the continent.
    const q = (vals: number[], f: number) => { const v = [...vals].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.max(0, Math.floor(f * (v.length - 1))))]; };
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const trim = points.length >= 20 ? 0.02 : 0;
    const b = L.latLngBounds([q(lats, trim), q(lngs, trim)], [q(lats, 1 - trim), q(lngs, 1 - trim)]);
    map.fitBounds(b.pad(0.08), { maxZoom: 12, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function HerdMap({ points, legend, dark }: {
  points: MapPoint[];
  legend: { label: string; color: string; count: number }[];
  dark: boolean;
}) {
  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2b9n_1_481d72d339003f7d23db5152'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2b9n_1_481d72d339003f7d23db5152';

  // Draw the most important (last in legend order) on top.
  const order = useMemo(() => new Map(legend.map((l, i) => [l.color, i])), [legend]);
  const sorted = useMemo(() => [...points].sort((a, b) => (order.get(a.color) ?? 0) - (order.get(b.color) ?? 0)), [points, order]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={[-1.5, 30.5]}
        zoom={7}
        minZoom={3}
        maxZoom={16}
        scrollWheelZoom
        preferCanvas
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tileUrl} />
        <FitBounds points={points} />
        {sorted.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={4 + Math.min(5, p.weight)}
            pathOptions={{ color: dark ? '#1a1a19' : '#ffffff', weight: 1.5, fillColor: p.color, fillOpacity: 0.85 }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.97}>
              <div style={{ fontSize: 12, minWidth: 180 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                {p.lines.map((l, i) => <div key={i} style={{ color: '#52514e' }}>{l}</div>)}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-2 py-0.5 text-[11px] text-gray-700 dark:text-gray-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
            {l.label}
            <span className="tabular-nums text-gray-400">{l.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
