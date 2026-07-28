'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { useViewerFilters } from '../DashboardViewerContext';

// Lazy load to avoid SSR issues with Leaflet
const ChoroplethMap = dynamic(
  () => import('../../dashboard/maps/ChoroplethMap').then(m => ({ default: m.ChoroplethMap })),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" /></div> }
);

interface ChoroplethMapWidgetProps {
  data?: {
    byCountry?: Array<{ countryCode: string; value: number; label?: string }>;
    indicator?: string;
    mode?: 'default' | 'benefiting';
  };
  config?: Record<string, unknown>;
  onCountryClick?: (code: string) => void;
}

export function ChoroplethMapWidget({ data, config, onCountryClick }: ChoroplethMapWidgetProps) {
  const { filters, setFilter } = useViewerFilters();

  const handleCountryClick = useCallback(
    (code: string) => {
      // Toggle: clicking same country deselects it
      if (filters.countryCode === code) {
        setFilter('countryCode', undefined);
      } else {
        setFilter('countryCode', code);
      }
      onCountryClick?.(code);
    },
    [filters.countryCode, setFilter, onCountryClick],
  );

  const handleReset = useCallback(() => {
    setFilter('countryCode', undefined);
    setFilter('recCode', undefined);
  }, [setFilter]);
  // Transform byCountry data to ChoroplethMap's expected CountryOutbreakData format
  // ChoroplethMap expects objects with: code, outbreaks, cases, deaths, vaccinations, submissions
  const mapData = useMemo(() => {
    if (!data?.byCountry?.length) return [];
    return data.byCountry.map(item => ({
      code: item.countryCode,
      name: item.label || item.countryCode,
      outbreaks: item.value,
      cases: item.value,
      deaths: 0,
      vaccinations: item.value,
      submissions: item.value,
      rec: '',
    }));
  }, [data?.byCountry]);

  const indicator = (data?.indicator || config?.indicator || 'submissions') as 'outbreaks' | 'cases' | 'vaccinations' | 'submissions';
  const mode = (data?.mode || config?.mode || 'default') as 'default' | 'benefiting';

  if (!mapData.length) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-gray-400">No geographic data available</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-[300px]">
      {filters.countryCode && (
        <button
          onClick={handleReset}
          className="absolute right-2 top-2 z-[500] inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="h-3 w-3" />
          {filters.countryCode}
        </button>
      )}
      <ChoroplethMap
        title=""
        data={mapData}
        indicator={indicator}
        mode={mode}
        bare={true}
        onCountryClick={handleCountryClick}
        selectedCountry={filters.countryCode}
        selectedRec={filters.recCode}
      />
    </div>
  );
}
