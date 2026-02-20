'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TranshumanceCorridorMarker {
  id: string;
  name: string;
  route: Array<[number, number]>;
  status: 'active' | 'inactive' | 'disrupted';
  species: string;
  estimatedAnimals: number;
}

interface TranshumanceMapProps {
  corridors?: TranshumanceCorridorMarker[];
  height?: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#2E7D32',
  inactive: '#9E9E9E',
  disrupted: '#C62828',
};

const AFRICA_CENTER: [number, number] = [5.0, 18.0];
const AFRICA_ZOOM = 3.5;

export function TranshumanceMap({
  corridors = [],
  height = '500px',
  className,
}: TranshumanceMapProps) {
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

      corridors.forEach((corridor) => {
        const color = STATUS_COLORS[corridor.status] ?? '#9E9E9E';

        // Draw polyline for the corridor route
        const polyline = L.polyline(corridor.route, {
          color,
          weight: 3,
          opacity: 0.8,
          dashArray: corridor.status === 'disrupted' ? '8, 6' : undefined,
        }).addTo(map);

        polyline.bindPopup(
          `<div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 180px;">
            <p style="font-weight: 600; margin: 0 0 4px;">${corridor.name}</p>
            <p style="color: #666; margin: 0 0 2px;">Species: ${corridor.species}</p>
            <p style="margin: 0 0 2px;"><strong>${corridor.estimatedAnimals.toLocaleString()}</strong> animals</p>
            <span style="
              display: inline-block;
              padding: 2px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 500;
              color: white;
              background: ${color};
            ">${corridor.status}</span>
          </div>`,
        );

        // Add start marker
        if (corridor.route.length > 0) {
          const startPoint = corridor.route[0];
          const startIcon = L.divIcon({
            html: `<div style="
              background: ${color};
              width: 10px;
              height: 10px;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            "></div>`,
            className: '',
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          });
          L.marker(startPoint, { icon: startIcon }).addTo(map);
        }

        // Add end marker (arrow-like)
        if (corridor.route.length > 1) {
          const endPoint = corridor.route[corridor.route.length - 1];
          const endIcon = L.divIcon({
            html: `<div style="
              background: ${color};
              width: 14px;
              height: 14px;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 0;
                height: 0;
                border-left: 4px solid white;
                border-top: 3px solid transparent;
                border-bottom: 3px solid transparent;
                margin-left: 1px;
              "></div>
            </div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker(endPoint, { icon: endIcon }).addTo(map);
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
