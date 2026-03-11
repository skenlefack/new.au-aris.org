'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((m) => m.Polygon), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), { ssr: false });
const ClickHandler = dynamic(() => import('./MapClickHandler').then((m) => m.MapClickHandler), { ssr: false });

interface GeoPolygonMapProps {
  value: Array<[number, number]> | null;
  onChange: (value: Array<[number, number]> | null) => void;
  mode: 'polygon' | 'line' | 'point' | 'selector';
  maxPoints?: number;
  /** CSS class for the map container div — defaults to 'h-52' */
  mapClassName?: string;
  /** Additional CSS class for the outer wrapper */
  className?: string;
}

export function GeoPolygonMap({
  value,
  onChange,
  mode = 'polygon',
  maxPoints = 50,
  mapClassName,
  className,
}: GeoPolygonMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [points, setPoints] = useState<Array<[number, number]>>(value || []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (value) setPoints(value);
  }, [value]);

  const center: [number, number] = points.length > 0
    ? [
        points.reduce((sum, p) => sum + p[0], 0) / points.length,
        points.reduce((sum, p) => sum + p[1], 0) / points.length,
      ]
    : [0, 20];

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setPoints((prev) => {
        if (prev.length >= maxPoints) return prev;
        const updated = [...prev, [lat, lng] as [number, number]];
        onChange(updated);
        return updated;
      });
    },
    [maxPoints, onChange],
  );

  const handleUndo = () => {
    setPoints((prev) => {
      const updated = prev.slice(0, -1);
      onChange(updated.length > 0 ? updated : null);
      return updated;
    });
  };

  const handleClear = () => {
    setPoints([]);
    onChange(null);
  };

  return (
    <div className={cn('flex flex-col space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700', className)}>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>{mode === 'polygon' ? 'Draw Area' : mode === 'line' ? 'Draw Line' : 'Geo Selector'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {points.length} point{points.length !== 1 ? 's' : ''}
          </span>
          {points.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                className="text-xs text-blue-400 hover:text-blue-500 flex items-center gap-0.5"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-500"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400">
        Click on the map to add points.{' '}
        {mode === 'polygon' && 'Add at least 3 points to form an area.'}
        {mode === 'line' && 'Add at least 2 points to form a line.'}
      </p>

      {isClient && (
        <div className={cn('rounded-lg overflow-hidden', mapClassName === 'h-full' ? 'flex-1 min-h-0' : (mapClassName || 'h-52'))}>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <MapContainer
            center={center}
            zoom={points.length > 0 ? 10 : 3}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <ClickHandler onClick={handleMapClick} />
            {mode === 'polygon' && points.length >= 3 && (
              <Polygon
                positions={points}
                pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.2 }}
              />
            )}
            {mode === 'line' && points.length >= 2 && (
              <Polyline
                positions={points}
                pathOptions={{ color: '#3B82F6', weight: 3 }}
              />
            )}
            {/* Show vertices as small circles */}
            {points.map((pos, idx) => (
              <CircleMarker
                key={idx}
                center={pos}
                radius={5}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: idx === 0 ? '#10B981' : '#3B82F6',
                  fillOpacity: 1,
                }}
              />
            ))}
            {/* Show preview line from last point while drawing */}
            {mode === 'line' && points.length === 1 && (
              <CircleMarker
                center={points[0]}
                radius={7}
                pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.3 }}
              />
            )}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
