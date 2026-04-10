'use client';

import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

interface MapClickHandlerProps {
  onClick: (lat: number, lng: number) => void;
}

export function MapClickHandler({ onClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Reactively updates the map view when center/zoom change,
 * and calls invalidateSize to fix rendering after container resize.
 */
export function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    // Fix map rendering when container size changes (e.g. fullscreen toggle)
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 300);
  });

  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center[0], center[1], zoom]);

  return null;
}
