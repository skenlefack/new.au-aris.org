'use client';

import React from 'react';
import { PAID_SECTORS, PAID_QUARTERS } from '@/lib/paid';
import type { PaidFilters as Filters } from '@/lib/paid';

interface PAIDFiltersProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  countries: string[];
  projects: string[];
  t: (key: string) => string;
  locale?: string;
}

export function PAIDFilters({ filters, onChange, countries, projects, t, locale = 'en' }: PAIDFiltersProps) {
  const set = (key: keyof Filters, val: string) => {
    onChange({ ...filters, [key]: val || undefined });
  };

  const sectorLabel = (s: typeof PAID_SECTORS[number]) => {
    const lang = locale as 'en' | 'fr' | 'es';
    return s.name[lang] || s.name.en;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quarter */}
      <select
        value={filters.quarter ?? ''}
        onChange={(e) => set('quarter', e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="">{t('allQuarters')}</option>
        {PAID_QUARTERS.map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </select>

      {/* Country */}
      <select
        value={filters.country ?? ''}
        onChange={(e) => set('country', e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="">{t('allCountries')}</option>
        {countries.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Sector */}
      <select
        value={filters.sector ?? ''}
        onChange={(e) => set('sector', e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="">{t('allSectors')}</option>
        {PAID_SECTORS.map((s) => (
          <option key={s.id} value={s.name.en}>{sectorLabel(s)}</option>
        ))}
      </select>

      {/* Project */}
      <select
        value={filters.project ?? ''}
        onChange={(e) => set('project', e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="">{t('allProjects')}</option>
        {projects.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}
