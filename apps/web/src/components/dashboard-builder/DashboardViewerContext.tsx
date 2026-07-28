'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface ViewerFilters {
  countryCode?: string;
  recCode?: string;
  year?: number;
  domain?: string;
}

interface ViewerContextValue {
  filters: ViewerFilters;
  setFilter: (key: keyof ViewerFilters, value: string | number | undefined) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const ViewerContext = createContext<ViewerContextValue>({
  filters: {},
  setFilter: () => {},
  resetFilters: () => {},
  activeFilterCount: 0,
});

export function DashboardViewerProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<ViewerFilters>({});

  const setFilter = useCallback((key: keyof ViewerFilters, value: string | number | undefined) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value || undefined };
      // Cascade: changing REC resets country
      if (key === 'recCode') next.countryCode = undefined;
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => setFilters({}), []);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(v => v !== undefined).length,
    [filters],
  );

  const value = useMemo(
    () => ({ filters, setFilter, resetFilters, activeFilterCount }),
    [filters, setFilter, resetFilters, activeFilterCount],
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewerFilters() {
  return useContext(ViewerContext);
}
