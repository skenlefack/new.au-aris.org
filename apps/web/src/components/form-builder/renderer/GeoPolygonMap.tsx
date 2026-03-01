'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Pencil } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((m) => m.Polygon), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });

interface GeoPolygonMapProps {
  value: Array<[number, number]> | null;
  onChange: (value: Array<[number, number]> | null) => void;
  mode: 'polygon' | 'line' | 'point' | 'selector';
  maxPoints?: number;
}

export function GeoPolygonMap({
  value,
  onChange,
  mode = 'polygon',
  maxPoints = 50,
}: GeoPolygonMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [points, setPoints] = useState<Array<[number, number]>>(value || []);
  const [drawing, setDrawing] = useState(false);

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

  const handleClear = () => {
    setPoints([]);
    onChange(null);
  };

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
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
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-400 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400">
        Click on the map to add points. {mode === 'polygon' && 'Close the shape by clicking the first point.'}
      </p>

      {isClient && (
        <div className="h-52 rounded-lg overflow-hidden">
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
            {mode === 'polygon' && points.length >= 3 && (
              <Polygon
    
                positions={points}
                pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.2 }}
              />
            )}
            {mode === 'line' && points.length >= 2 && (
              <Polyline
    
                positions={points}
                pathOptions={{ color: '#3B82F6' }}
              />
            )}
            {points.map((pos, idx) => (
              <Marker
                key={idx}
    
                position={pos}
              />
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
