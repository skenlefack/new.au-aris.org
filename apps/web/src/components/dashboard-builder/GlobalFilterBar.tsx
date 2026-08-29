'use client';

import React from 'react';
import { Filter, Globe, Calendar, X } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

export interface GlobalFilters {
  countryCode?: string;
  recCode?: string;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  domainCode?: string;
  period?: string;
}

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  onChange: (filters: GlobalFilters) => void;
}

const REC_OPTIONS = [
  { code: 'IGAD', label: 'IGAD' },
  { code: 'ECOWAS', label: 'ECOWAS / CEDEAO' },
  { code: 'SADC', label: 'SADC' },
  { code: 'ECCAS', label: 'ECCAS / CEEAC' },
  { code: 'EAC', label: 'EAC' },
  { code: 'AMU', label: 'UMA / AMU' },
  { code: 'COMESA', label: 'COMESA' },
  { code: 'CEN-SAD', label: 'CEN-SAD' },
];

const DOMAIN_OPTION_KEYS = [
  { code: 'animal-health', labelKey: 'domainAnimalHealth' },
  { code: 'livestock-prod', labelKey: 'domainLivestock' },
  { code: 'fisheries', labelKey: 'domainFisheries' },
  { code: 'trade-sps', labelKey: 'domainTradeSps' },
  { code: 'governance', labelKey: 'domainGovernance' },
  { code: 'wildlife', labelKey: 'domainWildlife' },
  { code: 'apiculture', labelKey: 'domainApiculture' },
  { code: 'climate-env', labelKey: 'domainClimateEnv' },
  { code: 'paid', labelKey: 'domainPaid' },
];

const PERIOD_OPTION_KEYS = [
  { code: 'last_7d', labelKey: 'periodLast7d' },
  { code: 'last_30d', labelKey: 'periodLast30d' },
  { code: 'last_90d', labelKey: 'periodLast90d' },
  { code: 'last_12m', labelKey: 'periodLast12m' },
  { code: 'ytd', labelKey: 'periodYtd' },
  { code: 'all', labelKey: 'periodAll' },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export function GlobalFilterBar({ filters, onChange }: GlobalFilterBarProps) {
  const t = useTranslations('dashboard');
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const update = (key: keyof GlobalFilters, value: string | number | undefined) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clearAll = () => onChange({});

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
        <Filter className="h-3.5 w-3.5" />
        {t('filters')}
      </div>

      {/* Country */}
      <input
        type="text"
        value={filters.countryCode || ''}
        onChange={(e) => update('countryCode', e.target.value.toUpperCase().slice(0, 2))}
        placeholder={t('filterCountry')}
        maxLength={2}
        className="w-16 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100 uppercase"
      />

      {/* REC */}
      <select
        value={filters.recCode || ''}
        onChange={(e) => update('recCode', e.target.value)}
        className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
      >
        <option value="">{t('filterRec')}</option>
        {REC_OPTIONS.map((r) => (
          <option key={r.code} value={r.code}>{r.label}</option>
        ))}
      </select>

      {/* Domain */}
      <select
        value={filters.domainCode || ''}
        onChange={(e) => update('domainCode', e.target.value)}
        className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
      >
        <option value="">{t('filterDomain')}</option>
        {DOMAIN_OPTION_KEYS.map((d) => (
          <option key={d.code} value={d.code}>{t(d.labelKey)}</option>
        ))}
      </select>

      {/* Year */}
      <select
        value={filters.year || ''}
        onChange={(e) => update('year', e.target.value ? parseInt(e.target.value) : undefined)}
        className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
      >
        <option value="">{t('filterYear')}</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Period preset */}
      <select
        value={filters.period || ''}
        onChange={(e) => update('period', e.target.value)}
        className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
      >
        <option value="">{t('filterPeriod')}</option>
        {PERIOD_OPTION_KEYS.map((p) => (
          <option key={p.code} value={p.code}>{t(p.labelKey)}</option>
        ))}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => update('dateFrom', e.target.value)}
          className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-1.5 py-1 text-xs text-gray-900 dark:text-gray-100"
        />
        <span className="text-xs text-gray-400">-</span>
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => update('dateTo', e.target.value)}
          className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-1.5 py-1 text-xs text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Clear all */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <X className="h-3 w-3" />
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
