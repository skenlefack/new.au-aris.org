'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import type { OutbreakMarker } from '@/components/maps/AfricaMap';
import { useOutbreakMarkers } from '@/lib/api/hooks';
import { MapSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const AfricaMap = dynamic(
  () =>
    import('@/components/maps/AfricaMap').then((mod) => mod.AfricaMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

const PLACEHOLDER_MARKERS: OutbreakMarker[] = [
  { id: 'ob-1', lat: -1.286, lng: 36.817, disease: 'Foot-and-Mouth Disease', country: 'Kenya', severity: 'high', cases: 234, status: 'confirmed' },
  { id: 'ob-2', lat: 9.005, lng: 38.763, disease: 'Peste des Petits Ruminants', country: 'Ethiopia', severity: 'critical', cases: 412, status: 'confirmed' },
  { id: 'ob-3', lat: 9.06, lng: 7.49, disease: 'Highly Pathogenic Avian Influenza', country: 'Nigeria', severity: 'critical', cases: 89, status: 'confirmed' },
  { id: 'ob-4', lat: 14.693, lng: -17.444, disease: 'African Swine Fever', country: 'Senegal', severity: 'medium', cases: 45, status: 'suspected' },
  { id: 'ob-5', lat: -6.162, lng: 35.75, disease: 'Rift Valley Fever', country: 'Tanzania', severity: 'low', cases: 12, status: 'resolved' },
  { id: 'ob-6', lat: -25.747, lng: 28.229, disease: 'FMD', country: 'South Africa', severity: 'medium', cases: 67, status: 'confirmed' },
  { id: 'ob-7', lat: 5.614, lng: -0.186, disease: 'Newcastle Disease', country: 'Ghana', severity: 'low', cases: 23, status: 'confirmed' },
  { id: 'ob-8', lat: 0.347, lng: 32.582, disease: 'PPR', country: 'Uganda', severity: 'medium', cases: 78, status: 'confirmed' },
  { id: 'ob-9', lat: 30.044, lng: 31.236, disease: 'Lumpy Skin Disease', country: 'Egypt', severity: 'high', cases: 156, status: 'confirmed' },
  { id: 'ob-10', lat: -4.441, lng: 15.266, disease: 'HPAI', country: 'DR Congo', severity: 'low', cases: 8, status: 'suspected' },
];

export default function OutbreakMapPage() {
  const { data, isLoading, isError, error, refetch } = useOutbreakMarkers();
  const markers: OutbreakMarker[] = data?.data ?? PLACEHOLDER_MARKERS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/animal-health"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outbreak Map</h1>
            <p className="mt-1 text-sm text-gray-500">
              Continental view of active disease events
            </p>
          </div>
        </div>
        <Link
          href="/animal-health"
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <List className="h-4 w-4" />
          List View
        </Link>
      </div>

      {isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load markers'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <AfricaMap
            markers={markers}
            height="600px"
            onMarkerClick={(m) => {
              window.location.href = `/animal-health/events/${m.id}`;
            }}
          />
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
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

          {/* Stats summary */}
          {isLoading ? null : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-card border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-400">Total Events</p>
                <p className="text-xl font-bold text-gray-900">
                  {markers.length}
                </p>
              </div>
              <div className="rounded-card border border-red-200 bg-red-50 p-4">
                <p className="text-xs text-red-600">Critical</p>
                <p className="text-xl font-bold text-red-700">
                  {markers.filter((m) => m.severity === 'critical').length}
                </p>
              </div>
              <div className="rounded-card border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs text-orange-600">High</p>
                <p className="text-xl font-bold text-orange-700">
                  {markers.filter((m) => m.severity === 'high').length}
                </p>
              </div>
              <div className="rounded-card border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-400">Total Cases</p>
                <p className="text-xl font-bold text-gray-900">
                  {markers.reduce((sum, m) => sum + m.cases, 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
