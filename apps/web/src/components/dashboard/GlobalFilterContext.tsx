'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface DashboardFilters {
  period: string;        // 'last_12_months', 'last_6_months', '2025', '2024', 'custom'
  rec: string;           // REC code or 'all'
  country: string;       // Country ISO code or 'all'
  domain: string;        // Domain code or 'all'
  disease: string;       // Disease code or 'all'
  species: string;       // Species code or 'all'
}

interface FilterContextValue {
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const DEFAULT_FILTERS: DashboardFilters = {
  period: 'last_12_months',
  rec: 'all',
  country: 'all',
  domain: 'all',
  disease: 'all',
  species: 'all',
};

const FilterContext = createContext<FilterContextValue>({
  filters: DEFAULT_FILTERS,
  setFilter: () => {},
  resetFilters: () => {},
  activeFilterCount: 0,
});

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const setFilter = useCallback((key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Cascade: when REC changes, reset country
      if (key === 'rec') {
        next.country = 'all';
      }
      // Cascade: when domain changes, reset disease and species
      if (key === 'domain') {
        next.disease = 'all';
        next.species = 'all';
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.period !== 'last_12_months') count++;
    if (filters.rec !== 'all') count++;
    if (filters.country !== 'all') count++;
    if (filters.domain !== 'all') count++;
    if (filters.disease !== 'all') count++;
    if (filters.species !== 'all') count++;
    return count;
  }, [filters]);

  const value = useMemo(
    () => ({ filters, setFilter, resetFilters, activeFilterCount }),
    [filters, setFilter, resetFilters, activeFilterCount],
  );

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useDashboardFilters() {
  return useContext(FilterContext);
}
