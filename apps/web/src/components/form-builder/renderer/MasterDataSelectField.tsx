'use client';

import React, { useMemo } from 'react';
import { useRefDataForSelect, type RefDataType } from '@/lib/api/ref-data-hooks';

interface MasterDataSelectFieldProps {
  masterDataType: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  parentFilter?: Record<string, string>;
  className?: string;
}

const VALID_REF_TYPES: Set<string> = new Set([
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
]);

export function MasterDataSelectField({
  masterDataType,
  value,
  onChange,
  placeholder,
  parentFilter,
  className,
}: MasterDataSelectFieldProps) {
  const isValidType = VALID_REF_TYPES.has(masterDataType);

  const { data, isLoading, isError } = useRefDataForSelect(
    (isValidType ? masterDataType : 'species') as RefDataType,
    parentFilter,
    isValidType,
  );

  const options = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((item) => ({
      value: item.id,
      label: item.name?.en || item.name?.fr || item.code || item.id,
    }));
  }, [data]);

  return (
    <select
      value={value || ''}
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
