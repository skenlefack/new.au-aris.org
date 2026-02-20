import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  popupContent?: React.ReactNode;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
}

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  layers?: MapLayer[];
  onMarkerClick?: (markerId: string) => void;
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  height?: string;
  className?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  center = [1.5, 20.0],
  zoom = 4,
  markers = [],
  layers = [],
  onMarkerClick,
  onLayerToggle,
  height = '400px',
  className,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);

  useEffect(() => {
    let map: unknown;

    async function initMap() {
      try {
        const L = await import('leaflet');

        if (!mapRef.current || leafletMapRef.current) return;

        map = L.map(mapRef.current).setView(center, zoom);
        leafletMapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map as L.Map);

        markers.forEach((marker) => {
          const m = L.marker([marker.lat, marker.lng]).addTo(map as L.Map);
          if (marker.label) {
            m.bindTooltip(marker.label);
          }
          if (onMarkerClick) {
            m.on('click', () => onMarkerClick(marker.id));
          }
        });
      } catch {
        // leaflet not available — render fallback
      }
    }

    initMap();

    return () => {
      if (leafletMapRef.current) {
        (leafletMapRef.current as { remove: () => void }).remove();
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="map-view" className={cn('relative overflow-hidden rounded-card border border-gray-200', className)}>
      <div ref={mapRef} style={{ height, width: '100%' }} data-testid="map-container" />

      {layers.length > 0 && (
        <div
          data-testid="layer-controls"
          className="absolute right-3 top-3 z-[1000] rounded-lg border border-gray-200 bg-white p-3 shadow-md"
        >
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Layers
          </h4>
          {layers.map((layer) => (
            <label key={layer.id} className="flex items-center gap-2 py-1 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(e) => onLayerToggle?.(layer.id, e.target.checked)}
                className="rounded border-gray-300 text-aris-primary-600"
              />
              {layer.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
