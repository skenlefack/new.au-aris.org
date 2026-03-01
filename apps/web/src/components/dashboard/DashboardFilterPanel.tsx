'use client';

import React from 'react';
import {
  Filter, RotateCcw, ChevronDown, LayoutDashboard, TrendingUp, Map,
  Shield, Syringe, ArrowLeftRight, AlertTriangle, Activity, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardFilters } from './GlobalFilterContext';
import { getAllRecs, type RecConfig } from '@/data/recs-config';
import { COUNTRIES, getCountriesByRec } from '@/data/countries-config';

interface DashboardFilterPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  activePage: string;
  onPageChange: (page: string) => void;
}

const PERIODS = [
  { value: 'last_12_months', label: 'Last 12 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
];

const DOMAINS = [
  { value: 'all', label: 'All Domains' },
  { value: 'animal-health', label: 'Animal Health' },
  { value: 'livestock-prod', label: 'Livestock' },
  { value: 'fisheries', label: 'Fisheries' },
  { value: 'trade-sps', label: 'Trade & SPS' },
  { value: 'wildlife', label: 'Wildlife' },
  { value: 'apiculture', label: 'Apiculture' },
  { value: 'climate-env', label: 'Climate & Env' },
  { value: 'governance', label: 'Governance' },
];

const PAGES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'by-rec', label: 'By REC', icon: Map },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'surveillance', label: 'Surveillance', icon: Shield },
  { id: 'vaccination', label: 'Vaccination', icon: Syringe },
  { id: 'trade', label: 'Trade & SPS', icon: ArrowLeftRight },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'system', label: 'System', icon: Activity },
];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
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
          className={cn(
            'w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-800 px-3 py-2 pr-8 text-xs font-medium',
            'text-gray-700 dark:text-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'transition-colors duration-150',
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
}: DashboardFilterPanelProps) {
  const { filters, setFilter, resetFilters, activeFilterCount } = useDashboardFilters();

  const allRecs = getAllRecs();
  const recOptions = [
    { value: 'all', label: 'All RECs' },
    ...allRecs.map((r: RecConfig) => ({ value: r.code, label: r.name })),
  ];

  const countryList = filters.rec !== 'all'
    ? getCountriesByRec(filters.rec)
    : Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
  const countryOptions = [
    { value: 'all', label: 'All Countries' },
    ...countryList.map((c) => ({ value: c.code, label: c.name })),
  ];

  if (collapsed) {
    return (
      <div className="flex-shrink-0 flex flex-col items-center pt-3 w-12">
        <button
          onClick={onToggle}
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors"
          title="Show filters"
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
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Filters</span>
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
            title="Collapse filters"
          >
            ←
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <FilterSelect
          label="Period"
          value={filters.period}
          options={PERIODS}
          onChange={(v) => setFilter('period', v)}
        />

        <FilterSelect
          label="REC"
          value={filters.rec}
          options={recOptions}
          onChange={(v) => setFilter('rec', v)}
        />

        <FilterSelect
          label="Country"
          value={filters.country}
          options={countryOptions}
          onChange={(v) => setFilter('country', v)}
        />

        <FilterSelect
          label="Domain"
          value={filters.domain}
          options={DOMAINS}
          onChange={(v) => setFilter('domain', v)}
        />

        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All Filters
          </button>
        )}
      </div>

      {/* Dashboard Pages */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Dashboard Pages
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
          BI Tools
        </p>
        <div className="space-y-0.5">
          <a
            href="/bi-tools/superset"
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            Superset
            <span className="ml-auto text-[9px] rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">Active</span>
          </a>
          <a
            href="/bi-tools/metabase"
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            Metabase
            <span className="ml-auto text-[9px] rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">Active</span>
          </a>
          <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 opacity-50">
            <BarChart3 className="h-3 w-3" />
            Power BI
            <span className="ml-auto text-[9px] rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
