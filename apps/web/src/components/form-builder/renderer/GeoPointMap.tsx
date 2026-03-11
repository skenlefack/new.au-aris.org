'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const ClickHandler = dynamic(() => import('./MapClickHandler').then((m) => m.MapClickHandler), { ssr: false });

interface GeoPointMapProps {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number } | null) => void;
  showManualEntry?: boolean;
  autoDetect?: boolean;
  /** CSS class for the map container div — defaults to 'h-48' */
  mapClassName?: string;
  /** Additional CSS class for the outer wrapper */
  className?: string;
}

export function GeoPointMap({
  value,
  onChange,
  showManualEntry = true,
  autoDetect = true,
  mapClassName,
  className,
}: GeoPointMapProps) {
  const [lat, setLat] = useState(value?.lat?.toString() || '');
  const [lng, setLng] = useState(value?.lng?.toString() || '');
  const [isClient, setIsClient] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (value) {
      setLat(value.lat.toFixed(6));
      setLng(value.lng.toFixed(6));
    }
  }, [value]);

  const handleManualChange = useCallback(() => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isNaN(latNum) && !isNaN(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
      onChange({ lat: latNum, lng: lngNum });
    }
  }, [lat, lng, onChange]);

  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newVal = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(newVal);
        setLat(newVal.lat.toFixed(6));
        setLng(newVal.lng.toFixed(6));
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onChange]);

  const handleMapClick = useCallback(
    (clickLat: number, clickLng: number) => {
      onChange({ lat: clickLat, lng: clickLng });
    },
    [onChange],
  );

  const center = value
    ? [value.lat, value.lng] as [number, number]
    : [0, 20] as [number, number];

  return (
    <div className={cn('flex flex-col space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700', className)}>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Navigation className="h-4 w-4" />
        <span>GPS Location</span>
        {autoDetect && (
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={detecting}
            className="ml-auto text-xs text-blue-500 hover:text-blue-600 disabled:text-gray-400"
          >
            {detecting ? 'Detecting...' : 'Auto-detect'}
          </button>
        )}
      </div>

      {showManualEntry && (
        <div className="flex gap-2">
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            onBlur={handleManualChange}
            placeholder="Latitude"
            className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            onBlur={handleManualChange}
            placeholder="Longitude"
            className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      )}

      <p className="text-[10px] text-gray-400">
        Click on the map to place a marker.
      </p>

      {isClient && (
        <div className={cn('rounded-lg overflow-hidden', mapClassName === 'h-full' ? 'flex-1 min-h-0' : (mapClassName || 'h-48'))}>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <MapContainer
            center={center}
            zoom={value ? 12 : 3}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <ClickHandler onClick={handleMapClick} />
            {value && (
              <Marker position={[value.lat, value.lng]} />
            )}
          </MapContainer>
        </div>
      )}

      {value && (
        <p className="text-[10px] text-gray-400">
          {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
