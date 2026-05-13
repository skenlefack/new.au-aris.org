'use client';

import React, { useMemo } from 'react';
import { useRefDataForSelect, type RefDataType } from '@/lib/api/ref-data-hooks';

interface MasterDataSelectFieldProps {
  masterDataType: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  parentFilter?: Record<string, string>;
  className?: string;
  multiple?: boolean;
}

const VALID_REF_TYPES: Set<string> = new Set([
  // Non-ref tables with dedicated /for-select routes
  'countries', 'geo-entities', 'units',
  // Ref tables
  'species-groups', 'species', 'age-groups', 'diseases',
  'clinical-signs', 'control-measures', 'seizure-reasons',
  'sample-types', 'contamination-sources', 'abattoirs',
  'markets', 'checkpoints', 'production-systems',
  'breeds', 'vaccine-types', 'test-types', 'labs',
  'livestock-products', 'census-methodologies',
  'gear-types', 'vessel-types', 'aquaculture-farm-types', 'landing-sites',
  'conservation-statuses', 'habitat-types', 'crime-types',
  'commodities', 'hive-types', 'bee-diseases', 'floral-sources',
  'legal-framework-types', 'stakeholder-types',
  'infrastructures',
  // Phase 4 — WOAH/References-data enrichment
  'diagnosis-bases', 'body-parts', 'causal-agent-types',
  'outbreak-statuses', 'epidemiological-unit-types', 'notification-reasons',
  'source-of-infections', 'transport-modes', 'animal-sexes',
  'animal-husbandries', 'genetic-diversities', 'data-sources',
  'fish-families',
]);

export function MasterDataSelectField({
  masterDataType,
  value,
  onChange,
  placeholder,
  parentFilter,
  className,
  multiple,
}: MasterDataSelectFieldProps) {
  const isValidType = VALID_REF_TYPES.has(masterDataType);

  const { data, isLoading, isError } = useRefDataForSelect(
    (isValidType ? masterDataType : masterDataType) as RefDataType,
    parentFilter,
    isValidType,
  );

  const options = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((item: any) => {
      let label = '';
      if (item.name && typeof item.name === 'object') {
        label = item.name.en || item.name.fr || item.name.pt || '';
      } else if (typeof item.name === 'string') {
        label = item.name;
      }
      if (!label) label = item.code || item.id;
      if (item.flag) label = `${item.flag} ${label}`;
      return { value: item.id, label };
    });
  }, [data]);

  const selectedArray = useMemo(() => {
    if (!value) return [] as string[];
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed as string[]; } catch { /* ignore */ }
    return [value];
  }, [value]);

  if (multiple) {
    const toggleValue = (id: string) => {
      const next = selectedArray.includes(id)
        ? selectedArray.filter((v) => v !== id)
        : [...selectedArray, id];
      onChange(next);
    };

    return (
      <div className="space-y-1 rounded-lg border border-gray-200 p-2 max-h-60 overflow-y-auto dark:border-gray-700">
        {isLoading && <span className="text-xs text-gray-400">Loading...</span>}
        {isError && <span className="text-xs text-red-400">Error loading {masterDataType}</span>}
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1">
            <input
              type="checkbox"
              checked={selectedArray.includes(opt.value)}
              onChange={() => toggleValue(opt.value)}
              className="rounded border-gray-300"
            />
            {opt.label}
          </label>
        ))}
        {!isLoading && options.length === 0 && (
          <span className="text-xs text-gray-400">No options available</span>
        )}
      </div>
    );
  }

  return (
    <select
      value={(typeof value === 'string' ? value : '') || ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">
        {isLoading
          ? 'Loading...'
          : isError
            ? `Error loading ${masterDataType}`
            : placeholder || `Select ${masterDataType}...`}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
