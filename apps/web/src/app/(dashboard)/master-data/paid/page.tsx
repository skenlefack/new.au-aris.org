'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePaidReferentials,
  useCreatePaidRef,
  useDeletePaidRef,
  type PaidRefCategory,
  type PaidReferentialItem,
} from '@/lib/api/ref-data-hooks';
import { useSearchParams } from 'next/navigation';

type TabKey = 'projects' | 'logframes' | 'lf-activities' | 'subactivities' | 'paid-activities'
  | 'breakdown-fields' | 'executive-partners' | 'impl-partners-intl' | 'impl-partners-national';

const TABS: { key: TabKey; label: string; category: PaidRefCategory; parentKey?: string; parentLabel?: string }[] = [
  { key: 'projects', label: 'Projects', category: 'PAID_PROJECT' },
  { key: 'logframes', label: 'Log Frames (AMERT)', category: 'PAID_LOGFRAME', parentKey: 'project', parentLabel: 'Project' },
  { key: 'lf-activities', label: 'Activities', category: 'PAID_LF_ACTIVITY', parentKey: 'logframe', parentLabel: 'Log Frame' },
  { key: 'subactivities', label: 'Sub-Activities', category: 'PAID_SUBACTIVITY', parentKey: 'activity', parentLabel: 'Activity' },
  { key: 'paid-activities', label: 'PAID Activities', category: 'PAID_PAID_ACTIVITY', parentKey: 'subactivity', parentLabel: 'Sub-Activity' },
  { key: 'breakdown-fields', label: 'Breakdown Fields', category: 'PAID_BREAKDOWN_FIELD', parentKey: 'paid_activity', parentLabel: 'PAID Activity' },
  { key: 'executive-partners', label: 'Executive Partners', category: 'PAID_EXEC_PARTNER', parentKey: 'project', parentLabel: 'Project' },
  { key: 'impl-partners-intl', label: 'Partners (Intl)', category: 'PAID_IMPL_PARTNER_INTL', parentKey: 'project', parentLabel: 'Project' },
  { key: 'impl-partners-national', label: 'Partners (National)', category: 'PAID_IMPL_PARTNER_NATIONAL', parentKey: 'project', parentLabel: 'Project' },
];

function getItemLabel(item: PaidReferentialItem): string {
  return item.title || item.label || item.name || item.field_label || item.code || String(item.id);
}

function getItemSublabel(item: PaidReferentialItem): string {
  const parts: string[] = [];
  if (item.code) parts.push(item.code);
  if (item.unit_of_measure) parts.push(`Unit: ${item.unit_of_measure}`);
  if (item.project_code) parts.push(`Project: ${item.project_code}`);
  if (item.logframe_code) parts.push(`LogFrame: ${item.logframe_code}`);
  if (item.activity_code) parts.push(`Activity: ${item.activity_code}`);
  if (item.subactivity_code) parts.push(`Sub: ${item.subactivity_code}`);
  if (item.country_code) parts.push(`Country: ${item.country_code}`);
  if (item.field_type) parts.push(`Type: ${item.field_type}`);
  if (item.type) parts.push(`Type: ${item.type}`);
  if (item.countries && Array.isArray(item.countries)) parts.push(`Countries: ${(item.countries as string[]).join(', ')}`);
  return parts.join(' | ');
}

export default function PaidMasterDataPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'projects';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [search, setSearch] = useState('');
  const [parentFilter, setParentFilter] = useState('');

  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (search) f.search = search;
    if (parentFilter && tab.parentKey) f[tab.parentKey] = parentFilter;
    return f;
  }, [search, parentFilter, tab.parentKey]);

  const { data, isLoading } = usePaidReferentials(tab.category, filters);
  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const deleteMut = useDeletePaidRef(tab.category);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/master-data"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Master Data
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          PAID Programme — Reference Data
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage LICS projects, log frames (AMERT), activities, sub-activities, PAID activities, breakdown fields and partners.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setSearch(''); setParentFilter(''); }}
            className={cn(
              'whitespace-nowrap px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-fuchsia-600 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab.label.toLowerCase()}...`}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        {tab.parentKey && (
          <input
            type="text"
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
            placeholder={`Filter by ${tab.parentLabel} code...`}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-fuchsia-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {total} record{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No records found</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item: PaidReferentialItem) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {getItemLabel(item)}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {getItemSublabel(item)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${getItemLabel(item)}"?`)) {
                      deleteMut.mutate(item.id);
                    }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
