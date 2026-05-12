'use client';

import React from 'react';
import {
  Filter, RotateCcw, ChevronDown, LayoutDashboard, TrendingUp, Map,
  Shield, Syringe, ArrowLeftRight, AlertTriangle, Activity, BarChart3, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useDashboardFilters } from './GlobalFilterContext';
import { getAllRecs, getRecsForCountry, type RecConfig } from '@/data/recs-config';
import { COUNTRIES, getCountriesByRec } from '@/data/countries-config';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useTenantStore, findParentRec, deriveCountryCodeFromEmail } from '@/lib/stores/tenant-store';

interface DashboardFilterPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  activePage: string;
  onPageChange: (page: string) => void;
  diseaseOptions?: Array<{ value: string; label: string }>;
}

function usePeriods() {
  const t = useTranslations('dashboard');
  return [
    { value: 'all', label: t('allYears') },
    { value: 'last_12_months', label: t('last12Months') },
    { value: 'last_6_months', label: t('last6Months') },
    ...Array.from({ length: 19 }, (_, i) => {
      const y = 2025 - i;
      return { value: String(y), label: String(y) };
    }),
  ];
}

function useFallbackDomains() {
  const t = useTranslations('dashboard');
  return [
    { value: 'all', label: t('allDomains') },
    { value: 'animal-health', label: t('domainAnimalHealth') },
    { value: 'livestock-prod', label: t('domainLivestock') },
    { value: 'fisheries', label: t('domainFisheries') },
    { value: 'trade-sps', label: t('domainTradeSps') },
    { value: 'wildlife', label: t('domainWildlife') },
    { value: 'apiculture', label: t('domainApiculture') },
    { value: 'climate-env', label: t('domainClimateEnv') },
    { value: 'governance', label: t('domainGovernance') },
  ];
}

function usePages() {
  const t = useTranslations('dashboard');
  return [
    { id: 'overview', label: t('pageOverview'), icon: LayoutDashboard },
    { id: 'by-rec', label: t('pageByRec'), icon: Map },
    { id: 'trends', label: t('pageTrends'), icon: TrendingUp },
    { id: 'surveillance', label: t('pageSurveillance'), icon: Shield },
    { id: 'vaccination', label: t('pageVaccination'), icon: Syringe },
    { id: 'trade', label: t('pageTrade'), icon: ArrowLeftRight },
    { id: 'alerts', label: t('pageAlerts'), icon: AlertTriangle },
    { id: 'system', label: t('pageSystem'), icon: Activity },
    { id: 'custom', label: t('pageCustom'), icon: Palette },
  ];
}

function SearchableFilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const t = useTranslations('dashboard');
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full text-left rounded-lg border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium',
          'text-gray-700 dark:text-gray-300 truncate',
        )}
      >
        {selectedLabel}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[220px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder ?? t('searchDiseases')}
              className="w-full rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-xs focus:outline-none focus:ring-1"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 truncate',
                  opt.value === value && 'font-bold text-blue-600 dark:text-blue-400',
                )}
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">{t('noResults')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-800 px-3 py-2 pr-8 text-xs font-medium',
            'text-gray-700 dark:text-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'transition-colors duration-150',
            disabled && 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50',
          )}
          style={{ focusRingColor: 'var(--color-accent)' } as any}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export function DashboardFilterPanel({
  collapsed,
  onToggle,
  activePage,
  onPageChange,
  diseaseOptions,
}: DashboardFilterPanelProps) {
  const t = useTranslations('dashboard');
  const { filters, setFilter, resetFilters, activeFilterCount } = useDashboardFilters();
  const user = useAuthStore((s) => s.user);
  const userDomains = useDomainStore((s) => s.userDomains);
  const allDomains = useDomainStore((s) => s.allDomains);
  const locale = useLocaleStore((s) => s.locale);
  const tenantTree = useTenantStore((s) => s.tenantTree);
  const selectedTenant = useTenantStore((s) => s.selectedTenant);

  const PERIODS = usePeriods();
  const FALLBACK_DOMAINS = useFallbackDomains();
  const PAGES = usePages();

  // Build domain options from store (user's domains or all for SUPER_ADMIN)
  const storeDomains = userDomains.length > 0 ? userDomains : allDomains;
  const domainOptions: Array<{ value: string; label: string }> = storeDomains.length > 0
    ? [
        { value: 'all', label: t('allDomains') },
        ...storeDomains.map((d) => ({
          value: d.code,
          label: d.name?.[locale] || d.name?.en || d.code,
        })),
      ]
    : FALLBACK_DOMAINS;

  const tenantLevel = user?.tenantLevel ?? selectedTenant?.level;
  const isMemberState = tenantLevel === 'MEMBER_STATE';
  const isRec = tenantLevel === 'REC';

  const allRecs = getAllRecs();

  // For MEMBER_STATE: derive a reliable country code from multiple sources
  const resolvedCountryCode: string | null = isMemberState
    ? (selectedTenant?.level === 'MEMBER_STATE' ? selectedTenant.code : null)
      ?? deriveCountryCodeFromEmail(user?.email)
      ?? null
    : null;

  // Compute REC options based on tenant level
  let recOptions: Array<{ value: string; label: string }>;
  let recDisabled = false;
  if (isMemberState) {
    // MEMBER_STATE: lock to their REC only
    const lookupKey = resolvedCountryCode
      ?? (selectedTenant?.level === 'MEMBER_STATE' ? selectedTenant.id : (user?.tenantId ?? ''));
    const parentRec = findParentRec(tenantTree, lookupKey);
    recOptions = parentRec
      ? [{ value: parentRec.code.toLowerCase(), label: parentRec.name }]
      : [{ value: filters.rec, label: filters.rec.toUpperCase() }];
    recDisabled = true;
  } else if (isRec && selectedTenant) {
    // REC_ADMIN: lock to their REC
    recOptions = [{ value: selectedTenant.code.toLowerCase(), label: selectedTenant.name }];
    recDisabled = true;
  } else {
    // CONTINENTAL / SUPER_ADMIN: all RECs
    recOptions = [
      { value: 'all', label: t('allRecs') },
      ...allRecs.map((r: RecConfig) => ({ value: r.code, label: r.name })),
    ];
  }

  // Compute country options based on tenant level
  let countryOptions: Array<{ value: string; label: string }>;
  let countryDisabled = false;
  if (isMemberState && resolvedCountryCode) {
    // MEMBER_STATE: lock to their country only
    const countryName = COUNTRIES[resolvedCountryCode]?.name ?? resolvedCountryCode;
    countryOptions = [{ value: resolvedCountryCode, label: countryName }];
    countryDisabled = true;
  } else if (isMemberState) {
    // MEMBER_STATE but couldn't resolve code — show locked placeholder
    countryOptions = [{ value: filters.country, label: filters.country }];
    countryDisabled = true;
  } else {
    // REC or CONTINENTAL: show countries within selected REC, with "All" option
    const countryList = filters.rec !== 'all'
      ? getCountriesByRec(filters.rec)
      : Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
    countryOptions = [
      { value: 'all', label: t('allCountries') },
      ...countryList.map((c) => ({ value: c.code, label: c.name })),
    ];
  }

  if (collapsed) {
    return (
      <div className="flex-shrink-0 flex flex-col items-center pt-3 w-12">
        <button
          onClick={onToggle}
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors"
          title={t('showFilters')}
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-[240px] border-r border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('filters')}</span>
            {activeFilterCount > 0 && (
              <span
                className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors text-xs"
            title={t('collapseFilters')}
          >
            ←
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <FilterSelect
          label={t('filterPeriod')}
          value={filters.period}
          options={PERIODS}
          onChange={(v) => setFilter('period', v)}
        />

        <FilterSelect
          label={t('filterRec')}
          value={filters.rec}
          options={recOptions}
          onChange={(v) => setFilter('rec', v)}
          disabled={recDisabled}
        />

        <FilterSelect
          label={t('filterCountry')}
          value={filters.country}
          options={countryOptions}
          onChange={(v) => setFilter('country', v)}
          disabled={countryDisabled}
        />

        <FilterSelect
          label={t('filterDomain')}
          value={filters.domain}
          options={domainOptions}
          onChange={(v) => setFilter('domain', v)}
        />

        <SearchableFilterSelect
          label={t('filterDisease')}
          value={filters.disease}
          options={[
            { value: 'all', label: t('allDiseases') },
            ...(diseaseOptions ?? []),
          ]}
          onChange={(v) => setFilter('disease', v)}
          placeholder={t('searchDiseases')}
        />

        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            {t('resetAllFilters')}
          </button>
        )}
      </div>

      {/* Dashboard Pages */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          {t('dashboardPages')}
        </p>
        <div className="space-y-0.5">
          {PAGES.map((page) => {
            const Icon = page.icon;
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => onPageChange(page.id)}
                className={cn(
                  'flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150',
                  isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700',
                )}
                style={isActive ? {
                  backgroundColor: 'var(--color-accent-light)',
                  color: 'var(--color-accent)',
                } : undefined}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {page.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* BI Tools links */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          {t('biTools')}
        </p>
        <div className="space-y-0.5">
          <a
            href="/bi-tools/superset"
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            Superset
            <span className="ml-auto text-[9px] rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">{t('biActive')}</span>
          </a>
          <a
            href="/bi-tools/metabase"
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            Metabase
            <span className="ml-auto text-[9px] rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">{t('biActive')}</span>
          </a>
          <a
            href="/bi-tools/grafana"
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            Grafana
            <span className="ml-auto text-[9px] rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">{t('biActive')}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
