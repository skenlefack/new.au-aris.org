'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Layers, MapPin, Globe, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutbreakMarker } from '@/components/maps/AfricaMap';
import { useOutbreakMarkers } from '@/lib/api/hooks';
import { MapSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const AfricaMap = dynamic(
  () => import('@/components/maps/AfricaMap').then((mod) => mod.AfricaMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

// ─── Placeholder markers for geographic analysis ────────────────────────────

const GEO_MARKERS: OutbreakMarker[] = [
  { id: 'geo-1', lat: -1.286, lng: 36.817, disease: 'FMD', country: 'Kenya', severity: 'high', cases: 234, status: 'confirmed' },
  { id: 'geo-2', lat: 9.005, lng: 38.763, disease: 'PPR', country: 'Ethiopia', severity: 'critical', cases: 412, status: 'confirmed' },
  { id: 'geo-3', lat: 9.06, lng: 7.49, disease: 'HPAI', country: 'Nigeria', severity: 'critical', cases: 89, status: 'confirmed' },
  { id: 'geo-4', lat: 14.693, lng: -17.444, disease: 'ASF', country: 'Senegal', severity: 'medium', cases: 45, status: 'suspected' },
  { id: 'geo-5', lat: -6.162, lng: 35.75, disease: 'RVF', country: 'Tanzania', severity: 'low', cases: 12, status: 'resolved' },
  { id: 'geo-6', lat: -25.747, lng: 28.229, disease: 'FMD', country: 'South Africa', severity: 'medium', cases: 67, status: 'confirmed' },
  { id: 'geo-7', lat: 5.614, lng: -0.186, disease: 'Newcastle Disease', country: 'Ghana', severity: 'low', cases: 23, status: 'confirmed' },
  { id: 'geo-8', lat: 0.347, lng: 32.582, disease: 'PPR', country: 'Uganda', severity: 'medium', cases: 78, status: 'confirmed' },
  { id: 'geo-9', lat: 30.044, lng: 31.236, disease: 'LSD', country: 'Egypt', severity: 'high', cases: 156, status: 'confirmed' },
  { id: 'geo-10', lat: -4.441, lng: 15.266, disease: 'HPAI', country: 'DR Congo', severity: 'low', cases: 8, status: 'suspected' },
  { id: 'geo-11', lat: -15.387, lng: 28.322, disease: 'FMD', country: 'Zambia', severity: 'medium', cases: 34, status: 'confirmed' },
  { id: 'geo-12', lat: 12.639, lng: -8.003, disease: 'PPR', country: 'Mali', severity: 'high', cases: 98, status: 'confirmed' },
];

const LAYER_OPTIONS = [
  { id: 'outbreaks', label: 'Disease Events', icon: MapPin, active: true },
  { id: 'risk', label: 'Risk Zones', icon: Layers, active: false },
  { id: 'coverage', label: 'Vaccination Coverage', icon: Globe, active: false },
  { id: 'density', label: 'Livestock Density', icon: BarChart3, active: false },
];

const REGION_STATS = [
  { region: 'East Africa', events: 18, critical: 3, countries: 8 },
  { region: 'West Africa', events: 12, critical: 2, countries: 15 },
  { region: 'Southern Africa', events: 8, critical: 1, countries: 10 },
  { region: 'Central Africa', events: 5, critical: 0, countries: 8 },
  { region: 'North Africa', events: 4, critical: 1, countries: 6 },
];

export default function GeoAnalysisPage() {
  const [layers, setLayers] = useState(LAYER_OPTIONS);
  const { data, isLoading, isError, error, refetch } = useOutbreakMarkers();
  const markers: OutbreakMarker[] = data?.data?.length ? data.data : GEO_MARKERS;

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, active: !l.active } : l)),
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Geographic Analysis
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Spatial analysis, risk layers, and choropleth maps
            </p>
          </div>
        </div>
      </div>

      {/* Layer toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {layers.map((layer) => {
          const Icon = layer.icon;
          return (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                layer.active
                  ? 'border-[#1B5E20] bg-[#1B5E20]/10 text-[#1B5E20]'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {layer.label}
            </button>
          );
        })}
      </div>

      {/* Map */}
      {isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load map data'}
          onRetry={() => refetch()}
        />
      ) : (
        <AfricaMap markers={markers} height="550px" />
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {markers.length} events
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2E7D32]" />
          Low
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F57F17]" />
          Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E65100]" />
          High
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C62828]" />
          Critical
        </span>
      </div>

      {/* Regional breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Events by Region
          </h3>
          <div className="space-y-3">
            {REGION_STATS.map((r) => (
              <div key={r.region} className="flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {r.region}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {r.countries} countries
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-[#1B5E20]"
                        style={{ width: `${Math.min((r.events / 20) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                      {r.events}
                    </span>
                  </div>
                  {r.critical > 0 && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {r.critical} critical
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Map Layers
          </h3>
          <div className="space-y-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-900/20">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Disease Events
              </p>
              <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
                Active outbreaks and surveillance points from all Member States
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 opacity-60 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Risk Zones
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Coming soon — Climate-based disease risk modelling
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 opacity-60 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Vaccination Coverage
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Coming soon — Choropleth of vaccination rates by admin level
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 opacity-60 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Livestock Density
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Coming soon — Heatmap from census denominators
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
