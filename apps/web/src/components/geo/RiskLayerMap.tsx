'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRiskLayersBbox, useSpatialAnalysis, type RiskLayerResponse } from '@/lib/api/geo-hooks';
import { cn } from '@/lib/utils';

// Dynamically import Leaflet components (SSR disabled)
const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false },
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then((m) => m.GeoJSON),
  { ssr: false },
);
const Popup = dynamic(
  () => import('react-leaflet').then((m) => m.Popup),
  { ssr: false },
);
const Circle = dynamic(
  () => import('react-leaflet').then((m) => m.Circle),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((m) => m.CircleMarker),
  { ssr: false },
);
const useMapEvents = dynamic(
  () => import('react-leaflet').then((m) => ({ default: m.useMapEvents as any })),
  { ssr: false },
) as any;

// Severity color mapping
const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#22c55e',       // green-500
  MEDIUM: '#eab308',    // yellow-500
  HIGH: '#f97316',      // orange-500
  CRITICAL: '#ef4444',  // red-500
};

const SEVERITY_FILL_OPACITY: Record<string, number> = {
  LOW: 0.15,
  MEDIUM: 0.25,
  HIGH: 0.35,
  CRITICAL: 0.45,
};

interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface RiskLayerMapProps {
  className?: string;
  center?: [number, number];
  zoom?: number;
  layerType?: string;
  analysisMode?: boolean;
  analysisRadiusKm?: number;
}

function MapEventHandler({
  onBoundsChange,
  onMapClick,
  analysisMode,
}: {
  onBoundsChange: (bbox: Bbox) => void;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  analysisMode: boolean;
}) {
  // We need to handle this without the hook since dynamic import is tricky
  // Instead we'll use a ref-based approach in the parent
  return null;
}

export function RiskLayerMap({
  className,
  center = [0, 20],
  zoom = 4,
  layerType,
  analysisMode = false,
  analysisRadiusKm = 50,
}: RiskLayerMapProps) {
  const [bbox, setBbox] = useState<Bbox | undefined>(undefined);
  const [selectedLayer, setSelectedLayer] = useState<RiskLayerResponse | null>(null);
  const [analysisPoint, setAnalysisPoint] = useState<{ lat: number; lng: number } | null>(null);

  const { data: bboxData } = useRiskLayersBbox(
    bbox ? { ...bbox, layerType } : undefined,
  );
  const spatialAnalysis = useSpatialAnalysis();

  const riskLayers = bboxData?.data ?? [];

  const handleBoundsChange = useCallback((newBbox: Bbox) => {
    setBbox(newBbox);
  }, []);

  const handleMapClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      if (!analysisMode) return;
      setAnalysisPoint(latlng);
      spatialAnalysis.mutate({
        point: latlng,
        radiusKm: analysisRadiusKm,
        layerTypes: layerType ? [layerType] : undefined,
      });
    },
    [analysisMode, analysisRadiusKm, layerType, spatialAnalysis],
  );

  const analysisResult = spatialAnalysis.data?.data;

  return (
    <div className={cn('relative h-[500px] w-full rounded-lg overflow-hidden border', className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render risk layers as colored polygons */}
        {riskLayers.map((layer) => {
          if (!layer.geometry) return null;
          const color = SEVERITY_COLORS[layer.severity] ?? '#6b7280';
          const fillOpacity = SEVERITY_FILL_OPACITY[layer.severity] ?? 0.2;

          return (
            <GeoJSON
              key={layer.id}
              data={{
                type: 'Feature' as const,
                geometry: layer.geometry,
                properties: {},
              } as any}
              style={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity,
              }}
              eventHandlers={{
                click: () => setSelectedLayer(layer),
              }}
            />
          );
        })}

        {/* Selected layer popup */}
        {selectedLayer && selectedLayer.geometry && (
          <Popup
            position={getGeometryCenter(selectedLayer.geometry)}
            eventHandlers={{ remove: () => setSelectedLayer(null) }}
          >
            <div className="min-w-[200px]">
              <h3 className="font-semibold text-sm">{selectedLayer.name}</h3>
              {selectedLayer.description && (
                <p className="text-xs text-gray-600 mt-1">{selectedLayer.description}</p>
              )}
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span>{selectedLayer.layerType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Severity:</span>
                  <span
                    className="font-medium"
                    style={{ color: SEVERITY_COLORS[selectedLayer.severity] }}
                  >
                    {selectedLayer.severity}
                  </span>
                </div>
                {selectedLayer.source && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source:</span>
                    <span>{selectedLayer.source}</span>
                  </div>
                )}
                {selectedLayer.validFrom && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valid from:</span>
                    <span>{new Date(selectedLayer.validFrom).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </Popup>
        )}

        {/* Spatial analysis results */}
        {analysisMode && analysisPoint && (
          <>
            <Circle
              center={[analysisPoint.lat, analysisPoint.lng]}
              radius={analysisRadiusKm * 1000}
              pathOptions={{
                color: '#3b82f6',
                weight: 2,
                fillColor: '#3b82f6',
                fillOpacity: 0.08,
                dashArray: '6 4',
              }}
            />
            {analysisResult?.nearbyEvents.map((event) => (
              <CircleMarker
                key={event.id}
                center={[event.latitude, event.longitude]}
                radius={5}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.7,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">{event.entityType}</div>
                    <div>Distance: {(event.distanceMeters / 1000).toFixed(1)} km</div>
                    <div>{new Date(event.occurredAt).toLocaleDateString()}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-lg bg-white/90 dark:bg-gray-800/90 p-3 shadow-lg backdrop-blur-sm">
        <div className="text-xs font-semibold mb-2">Severity</div>
        {Object.entries(SEVERITY_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-2 text-xs">
            <div
              className="h-3 w-3 rounded-sm border"
              style={{ backgroundColor: color, borderColor: color }}
            />
            <span>{level}</span>
          </div>
        ))}
        {analysisMode && (
          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
            Click map to analyze area
          </div>
        )}
      </div>

      {/* Analysis loading indicator */}
      {spatialAnalysis.isPending && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] rounded-full bg-blue-500 text-white text-xs px-3 py-1 shadow">
          Analyzing...
        </div>
      )}
    </div>
  );
}

/**
 * Get an approximate center point from a GeoJSON geometry for popup placement.
 */
function getGeometryCenter(geometry: { type: string; coordinates: unknown }): [number, number] {
  try {
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as [number, number];
      return [coords[1], coords[0]];
    }
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][][];
      const ring = coords[0];
      const lat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
      const lng = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
      return [lat, lng];
    }
    if (geometry.type === 'MultiPolygon') {
      const coords = geometry.coordinates as number[][][][];
      const ring = coords[0][0];
      const lat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
      const lng = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
      return [lat, lng];
    }
  } catch {
    // fallback
  }
  return [0, 20];
}
