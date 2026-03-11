'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

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

export interface DashboardFilterProviderProps {
  children: React.ReactNode;
  /** Initial filters based on user's tenant context */
  initialFilters?: Partial<DashboardFilters>;
}

export function DashboardFilterProvider({ children, initialFilters }: DashboardFilterProviderProps) {
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }));

  // Sync filters when initialFilters changes (handles zustand persist hydration race)
  const initialRef = useRef(initialFilters);
  useEffect(() => {
    if (
      initialFilters &&
      Object.keys(initialFilters).length > 0 &&
      (initialFilters.rec !== initialRef.current?.rec ||
        initialFilters.country !== initialRef.current?.country)
    ) {
      initialRef.current = initialFilters;
      setFilters((prev) => ({ ...prev, ...initialFilters }));
    }
  }, [initialFilters]);

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

  const baseFilters = useMemo(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }), [initialFilters]);

  const resetFilters = useCallback(() => {
    setFilters(baseFilters);
  }, [baseFilters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.period !== baseFilters.period) count++;
    if (filters.rec !== baseFilters.rec) count++;
    if (filters.country !== baseFilters.country) count++;
    if (filters.domain !== baseFilters.domain) count++;
    if (filters.disease !== baseFilters.disease) count++;
    if (filters.species !== baseFilters.species) count++;
    return count;
  }, [filters, baseFilters]);

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
