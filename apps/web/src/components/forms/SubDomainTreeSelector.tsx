'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, X, CheckSquare, Square } from 'lucide-react';
import { useDomainStore, type SubDomain } from '@/lib/stores/domain-store';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubDomainTreeSelectorProps {
  /** Currently selected domain codes (form-level, e.g. animal_health) */
  selectedDomains: string[];
  /** Currently selected sub-domain codes */
  value: string[];
  /** Called when sub-domain selection changes */
  onChange: (codes: string[]) => void;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/* ------------------------------------------------------------------ */
/*  Code mapping: form ↔ store                                         */
/* ------------------------------------------------------------------ */

const FORM_TO_STORE: Record<string, string> = {
  animal_health: 'animal-health',
  livestock: 'livestock-prod',
  fisheries: 'fisheries',
  trade_sps: 'trade-sps',
  wildlife: 'wildlife',
  apiculture: 'apiculture',
  climate_env: 'climate-env',
  governance: 'governance',
};

const STORE_TO_FORM: Record<string, string> = Object.fromEntries(
  Object.entries(FORM_TO_STORE).map(([k, v]) => [v, k]),
);

function toStoreCodes(formCodes: string[]): string[] {
  return formCodes.map((c) => FORM_TO_STORE[c] ?? c);
}

/* ------------------------------------------------------------------ */
/*  Label helpers                                                      */
/* ------------------------------------------------------------------ */

function getSubDomainLabel(sd: SubDomain, locale: string): string {
  if (locale === 'fr') return sd.labelFr || sd.labelEn || sd.code;
  if (locale === 'ar') return sd.labelAr || sd.labelFr || sd.labelEn || sd.code;
  if (locale === 'pt') return sd.labelPt || sd.labelEn || sd.code;
  return sd.labelEn || sd.labelFr || sd.code;
}

function getDomainLabel(storeCode: string): string {
  const formCode = STORE_TO_FORM[storeCode] ?? storeCode;
  return DOMAIN_OPTIONS.find((d) => d.value === formCode || d.value === storeCode)?.label ?? storeCode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SubDomainTreeSelector({
  selectedDomains,
  value,
  onChange,
  t,
}: SubDomainTreeSelectorProps) {
  const locale = useLocaleStore((s) => s.locale);
  const subDomainsMetadata = useDomainStore((s) => s.subDomainsMetadata);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Auto-expand newly added domains
  const storeCodes = useMemo(() => toStoreCodes(selectedDomains), [selectedDomains]);
  useEffect(() => {
    // When domains change, make sure none of the new ones are collapsed
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const code of storeCodes) next.delete(code);
      return next;
    });
  }, [storeCodes]);

  // Build tree: group sub-domains by store-level domain code
  const tree = useMemo(() => {
    const groups: Record<string, SubDomain[]> = {};
    const q = search.toLowerCase();

    for (const sd of subDomainsMetadata) {
      if (!sd.active) continue;
      if (!storeCodes.includes(sd.domainCode)) continue;

      if (q) {
        const match =
          sd.labelEn.toLowerCase().includes(q) ||
          sd.labelFr.toLowerCase().includes(q) ||
          (sd.labelPt?.toLowerCase().includes(q) ?? false) ||
          (sd.labelAr?.toLowerCase().includes(q) ?? false) ||
          sd.code.toLowerCase().includes(q);
        if (!match) continue;
      }

      if (!groups[sd.domainCode]) groups[sd.domainCode] = [];
      groups[sd.domainCode].push(sd);
    }

    // Sort sub-domains within each group by displayOrder
    for (const subs of Object.values(groups)) {
      subs.sort((a, b) => a.displayOrder - b.displayOrder);
    }

    // Sort groups in the same order as selectedDomains
    const ordered: [string, SubDomain[]][] = [];
    for (const sc of storeCodes) {
      if (groups[sc]) ordered.push([sc, groups[sc]]);
    }
    return ordered;
  }, [subDomainsMetadata, storeCodes, search]);

  const toggleCollapse = (domainCode: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(domainCode)) next.delete(domainCode);
      else next.add(domainCode);
      return next;
    });
  };

  const toggleSubDomain = (code: string) => {
    onChange(
      value.includes(code)
        ? value.filter((c) => c !== code)
        : [...value, code],
    );
  };

  const selectAllInDomain = (domainCode: string) => {
    const entry = tree.find(([dc]) => dc === domainCode);
    if (!entry) return;
    const domainSubCodes = entry[1].map((sd) => sd.code);
    const allSelected = domainSubCodes.every((c) => value.includes(c));
    if (allSelected) {
      onChange(value.filter((c) => !domainSubCodes.includes(c)));
    } else {
      const set = new Set(value);
      for (const c of domainSubCodes) set.add(c);
      onChange([...set]);
    }
  };

  const getChipLabel = (code: string) => {
    const sd = subDomainsMetadata.find((s) => s.code === code);
    if (!sd) return code;
    return `${getDomainLabel(sd.domainCode)} › ${getSubDomainLabel(sd, locale)}`;
  };

  // ── Guard states ──

  if (selectedDomains.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        {t('selectDomainFirst')}
      </p>
    );
  }

  const totalAvailable = tree.reduce((sum, [, subs]) => sum + subs.length, 0);

  if (totalAvailable === 0 && !search) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        {t('noSubDomainsAvailable')}
      </p>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full border border-aris-primary-200 bg-aris-primary-50 px-2.5 py-1 text-xs font-medium text-aris-primary-700 dark:border-aris-primary-700 dark:bg-aris-primary-900/20 dark:text-aris-primary-300"
            >
              {getChipLabel(code)}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-aris-primary-200 dark:hover:bg-aris-primary-800 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchSubDomains')}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
        />
      </div>

      {/* Tree */}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {tree.length === 0 && search ? (
          <p className="px-4 py-3 text-xs text-gray-400 italic">{t('noSubDomainsMatch')}</p>
        ) : (
          tree.map(([domainCode, subDomains]) => {
            const isOpen = !collapsed.has(domainCode) || !!search;
            const selectedCount = subDomains.filter((sd) => value.includes(sd.code)).length;
            const allSelected = selectedCount === subDomains.length;

            return (
              <div key={domainCode} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                {/* Domain header */}
                <div className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(domainCode)}
                    className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="flex-1">{getDomainLabel(domainCode)}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {selectedCount}/{subDomains.length}
                    </span>
                  </button>

                  {/* Select all / none */}
                  <button
                    type="button"
                    onClick={() => selectAllInDomain(domainCode)}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                      allSelected
                        ? 'bg-aris-primary-100 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                    title={allSelected ? t('deselectAll') : t('selectAllBtn')}
                  >
                    {allSelected ? (
                      <CheckSquare className="h-3 w-3" />
                    ) : (
                      <Square className="h-3 w-3" />
                    )}
                    {allSelected ? t('deselectAll') : t('selectAllBtn')}
                  </button>
                </div>

                {/* Sub-domain checkboxes */}
                {isOpen && (
                  <div className="pb-1.5">
                    {subDomains.map((sd) => {
                      const isChecked = value.includes(sd.code);
                      return (
                        <label
                          key={sd.code}
                          className={`flex cursor-pointer items-center gap-2.5 py-1.5 pl-10 pr-4 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                            isChecked
                              ? 'text-aris-primary-700 dark:text-aris-primary-300'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSubDomain(sd.code)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-aris-primary-600 focus:ring-aris-primary-500 dark:border-gray-600"
                          />
                          <span className="flex-1 truncate">{getSubDomainLabel(sd, locale)}</span>
                          {sd.typeEnum && (
                            <span
                              className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                sd.typeEnum === 'VALUE_CHAIN'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : sd.typeEnum === 'PATHOLOGY'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : sd.typeEnum === 'ORGANIZATIONAL'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {sd.typeEnum.replace('_', ' ')}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
