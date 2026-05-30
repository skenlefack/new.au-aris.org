'use client';

import React, { useMemo } from 'react';
import { useRefDataForSelect, usePaidReferentials, type RefDataType, type PaidRefCategory } from '@/lib/api/ref-data-hooks';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { MultiSearchCombobox } from '@/components/ui/MultiSearchCombobox';

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
  'countries', 'geo-entities', 'units',
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
  'diagnosis-bases', 'body-parts', 'causal-agent-types',
  'outbreak-statuses', 'epidemiological-unit-types', 'notification-reasons',
  'source-of-infections', 'transport-modes', 'animal-sexes',
  'animal-husbandries', 'genetic-diversities', 'data-sources',
  'fish-families',
]);

/** Map form-builder masterDataType → PAID API category */
const PAID_TYPE_MAP: Record<string, PaidRefCategory> = {
  'paid-sectors': 'PAID_SECTOR',
  'paid-activities': 'PAID_ACTIVITY',
  'paid-species': 'PAID_SPECIES',
  'paid-production-systems': 'PAID_PROD_SYSTEM',
  'paid-diseases': 'PAID_DISEASE',
  'paid-projects': 'PAID_PROJECT',
  'paid-partners-intl': 'PAID_PARTNER_INTL',
  'paid-partners-national': 'PAID_PARTNER_NATIONAL',
};

function isPaidType(type: string): boolean {
  return type in PAID_TYPE_MAP;
}

export function MasterDataSelectField({
  masterDataType,
  value,
  onChange,
  placeholder,
  parentFilter,
  className,
  multiple,
}: MasterDataSelectFieldProps) {
  const usePaid = isPaidType(masterDataType);
  const isValidType = usePaid || VALID_REF_TYPES.has(masterDataType);

  // Standard ref-data hook (non-PAID)
  const stdQuery = useRefDataForSelect(
    masterDataType as RefDataType,
    parentFilter,
    isValidType && !usePaid,
  );

  // PAID ref-data hook
  const paidCategory = PAID_TYPE_MAP[masterDataType];
  const paidFilters = useMemo(() => {
    if (!parentFilter) return undefined;
    return {
      sector: parentFilter.sector || parentFilter.sectorCode,
      species: parentFilter.species || parentFilter.speciesCode,
      country: parentFilter.country || parentFilter.countryCode,
      search: parentFilter.search,
    };
  }, [parentFilter]);

  const paidQuery = usePaidReferentials(
    usePaid ? paidCategory : ('PAID_SECTOR' as PaidRefCategory),
    usePaid ? paidFilters : undefined,
  );

  // Select data source
  const activeQuery = usePaid ? paidQuery : stdQuery;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  const options = useMemo(() => {
    const rawData = activeQuery.data?.data;
    if (!rawData || !Array.isArray(rawData)) return [];

    return rawData.map((item: any) => {
      let label = '';

      if (usePaid) {
        // PAID items have name_en, name_fr, title
        label = item.name_en || item.title || item.name_fr || '';
        // For projects, show symbol + title
        if (masterDataType === 'paid-projects' && item.title) {
          label = item.title;
        }
      } else {
        // Standard ref items have { name: { en, fr } }
        if (item.name && typeof item.name === 'object') {
          label = item.name.en || item.name.fr || item.name.pt || '';
        } else if (typeof item.name === 'string') {
          label = item.name;
        }
      }

      if (!label) label = item.code || String(item.id);
      if (item.flag) label = `${item.flag} ${label}`;

      // Use code as value for PAID (stable identifier), id for standard
      const val = usePaid ? (item.code || String(item.id)) : item.id;
      return { value: val, label };
    });
  }, [activeQuery.data, usePaid, masterDataType]);

  const selectedArray = useMemo(() => {
    if (!value) return [] as string[];
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed as string[]; } catch { /* ignore */ }
    return [value];
  }, [value]);

  if (multiple) {
    const selectedItems = options.filter((o) => selectedArray.includes(o.value));

    return (
      <MultiSearchCombobox<{ value: string; label: string }>
        value={selectedItems}
        onChange={(items) => onChange(items.map((i) => i.value))}
        items={options}
        labelKey={(o) => o.label}
        idKey={(o) => o.value}
        filterKey={(o) => o.label}
        placeholder={placeholder || `Select ${masterDataType.replace('paid-', '')}...`}
        allLabel="All"
        loading={isLoading}
        renderItem={(o) => <span>{o.label}</span>}
        renderChip={(o) => <span className="truncate max-w-[120px]">{o.label}</span>}
      />
    );
  }

  return (
    <SearchableSelect
      value={(typeof value === 'string' ? value : '') || ''}
      onChange={(v) => onChange(v)}
      options={options}
      placeholder={
        isLoading
          ? 'Loading...'
          : isError
            ? `Error loading ${masterDataType}`
            : placeholder || `Select ${masterDataType.replace('paid-', '')}...`
      }
      disabled={isLoading}
    />
  );
}
