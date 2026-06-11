'use client';

import React, { useMemo } from 'react';
import { useRefDataForSelect, usePaidReferentials, type RefDataType, type PaidRefCategory } from '@/lib/api/ref-data-hooks';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { MultiSearchCombobox } from '@/components/ui/MultiSearchCombobox';

interface MasterDataSelectFieldProps {
  masterDataType: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  /** Called with the full raw item when a single selection is made */
  onItemSelected?: (item: Record<string, unknown> | null) => void;
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
  'paid-projects': 'PAID_PROJECT',
  'paid-logframes': 'PAID_LOGFRAME',
  'paid-lf-activities': 'PAID_LF_ACTIVITY',
  'paid-subactivities': 'PAID_SUBACTIVITY',
  'paid-paid-activities': 'PAID_PAID_ACTIVITY',
  'paid-breakdown-fields': 'PAID_BREAKDOWN_FIELD',
  'paid-executive-partners': 'PAID_EXEC_PARTNER',
  'paid-impl-partners-intl': 'PAID_IMPL_PARTNER_INTL',
  'paid-impl-partners-national': 'PAID_IMPL_PARTNER_NATIONAL',
};

function isPaidType(type: string): boolean {
  return type in PAID_TYPE_MAP;
}

export function MasterDataSelectField({
  masterDataType,
  value,
  onChange,
  onItemSelected,
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
    const f: Record<string, string | undefined> = {};
    // Cascade filters for PAID v2 hierarchy
    if (parentFilter.project) f.project = parentFilter.project;
    if (parentFilter.type) f.type = parentFilter.type;
    if (parentFilter.logframe) f.logframe = parentFilter.logframe;
    if (parentFilter.activity) f.activity = parentFilter.activity;
    if (parentFilter.subactivity) f.subactivity = parentFilter.subactivity;
    if (parentFilter.paid_activity) f.paid_activity = parentFilter.paid_activity;
    if (parentFilter.country) f.country = parentFilter.country;
    if (parentFilter.search) f.search = parentFilter.search;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [parentFilter]);

  const paidQuery = usePaidReferentials(
    usePaid ? paidCategory : ('PAID_SECTOR' as PaidRefCategory),
    usePaid ? paidFilters : undefined,
  );

  // Select data source
  const activeQuery = usePaid ? paidQuery : stdQuery;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  // Client-side filtering for countries by project (project stores countries[] array)
  const projectCountries = useMemo(() => {
    if (masterDataType !== 'countries' || !parentFilter?.project) return null;
    // parentFilter.project is a project code — we need to look it up
    // Fetch project data to get its countries array
    return null; // Will be handled by projectQuery below
  }, [masterDataType, parentFilter]);

  // When type is 'countries' and filtered by project, fetch the project to get its countries[]
  const projectQuery = usePaidReferentials(
    'PAID_PROJECT' as PaidRefCategory,
    masterDataType === 'countries' && parentFilter?.project
      ? { search: parentFilter.project }
      : undefined,
  );

  const projectCountryCodes = useMemo(() => {
    if (masterDataType !== 'countries' || !parentFilter?.project) return null;
    const projects = projectQuery.data?.data ?? [];
    const proj = projects.find((p: any) => p.code === parentFilter.project);
    return proj?.countries as string[] | undefined ?? null;
  }, [masterDataType, parentFilter, projectQuery.data]);

  const options = useMemo(() => {
    const rawData = activeQuery.data?.data;
    if (!rawData || !Array.isArray(rawData)) return [];

    // Filter countries by project's countries[] if applicable
    let filtered = rawData;
    if (projectCountryCodes && masterDataType === 'countries') {
      filtered = rawData.filter((item: any) => {
        const code = item.code || item.id;
        return projectCountryCodes.includes(code);
      });
    }

    return filtered.map((item: any) => {
      let label = '';

      if (usePaid) {
        // PAID v2: items have label, title, or name
        label = item.label || item.title || item.name || item.field_label || '';
        // For projects, show code + title
        if (masterDataType === 'paid-projects' && item.title) {
          label = `${item.code} — ${item.title}`;
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
  }, [activeQuery.data, usePaid, masterDataType, projectCountryCodes]);

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

  // Build a rawData lookup for onItemSelected callback
  const rawDataMap = useMemo(() => {
    const rawData = activeQuery.data?.data;
    if (!rawData || !Array.isArray(rawData)) return new Map();
    const m = new Map<string, Record<string, unknown>>();
    for (const item of rawData) {
      const key = usePaid ? (item.code || String(item.id)) : item.id;
      m.set(key, item);
    }
    return m;
  }, [activeQuery.data, usePaid]);

  return (
    <SearchableSelect
      value={(typeof value === 'string' ? value : '') || ''}
      onChange={(v) => {
        onChange(v);
        if (onItemSelected) {
          onItemSelected(v ? (rawDataMap.get(v) ?? null) : null);
        }
      }}
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
