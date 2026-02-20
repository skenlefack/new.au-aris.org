'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface OutbreakMarker {
  id: string;
  lat: number;
  lng: number;
  disease: string;
  country: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cases: number;
  status: string;
}

interface AfricaMapProps {
  markers?: OutbreakMarker[];
  height?: string;
  className?: string;
  onMarkerClick?: (marker: OutbreakMarker) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: '#2E7D32',
  medium: '#F57F17',
  high: '#E65100',
  critical: '#C62828',
};

const AFRICA_CENTER: [number, number] = [2.0, 20.0];
const AFRICA_ZOOM = 3.5;

export function AfricaMap({
  markers = [],
  height = '500px',
  className,
  onMarkerClick,
}: AfricaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = await import('leaflet');
      // @ts-expect-error -- CSS import handled by Next.js bundler
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !mapContainerRef.current || mapInstanceRef.current)
        return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(AFRICA_CENTER, AFRICA_ZOOM);
      mapInstanceRef.current = map;

      L.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL ??
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        },
      ).addTo(map);

      markers.forEach((m) => {
        const color = SEVERITY_COLORS[m.severity] ?? '#9E9E9E';
        const icon = L.divIcon({
          html: `<div style="
            background: ${color};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></div>`,
          className: '',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 160px;">
            <p style="font-weight: 600; margin: 0 0 4px;">${m.disease}</p>
            <p style="color: #666; margin: 0 0 2px;">${m.country}</p>
            <p style="margin: 0 0 2px;"><strong>${m.cases}</strong> cases</p>
            <span style="
              display: inline-block;
              padding: 2px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 500;
              color: white;
              background: ${color};
            ">${m.severity}</span>
          </div>`,
        );

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(m));
        }
      });

      // Fit to Africa bounds
      map.fitBounds([
        [-35, -18], // SW
        [37, 52], // NE
      ]);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove(): void }).remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border border-gray-200 bg-white',
        className,
      )}
    >
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
    </div>
  );
}
