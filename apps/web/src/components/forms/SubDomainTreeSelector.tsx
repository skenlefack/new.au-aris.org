'use client';

import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useDomainStore, type SubDomain } from '@/lib/stores/domain-store';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubDomainTreeSelectorProps {
  /** Currently selected domain codes (parent filter) */
  selectedDomains: string[];
  /** Currently selected sub-domain codes */
  value: string[];
  /** Called when sub-domain selection changes */
  onChange: (codes: string[]) => void;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * DOMAIN_OPTIONS uses underscores (animal_health, trade_sps, climate_env)
 * but the domain store uses hyphens (animal-health, trade-sps, climate-env).
 * We normalise both to match.
 */
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

/** Convert form-level domain code(s) to store-level code(s) */
function toStoreCodes(formCodes: string[]): string[] {
  return formCodes.map((c) => FORM_TO_STORE[c] ?? c);
}

function getSubDomainLabel(sd: SubDomain, locale: string): string {
  switch (locale) {
    case 'fr': return sd.labelFr || sd.labelEn || sd.code;
    case 'ar': return sd.labelAr || sd.labelFr || sd.labelEn || sd.code;
    case 'pt': return sd.labelPt || sd.labelEn || sd.code;
    default:   return sd.labelEn || sd.labelFr || sd.code;
  }
}

function getDomainLabel(code: string): string {
  // Try store code first, then form code
  const formCode = STORE_TO_FORM[code] ?? code;
  return DOMAIN_OPTIONS.find((d) => d.value === formCode || d.value === code)?.label ?? code;
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set(toStoreCodes(selectedDomains)));

  // Group sub-domains by domain, filtered to selected domains only
  const tree = useMemo(() => {
    // Convert form-level codes (underscores) to store-level codes (hyphens)
    const storeCodes = toStoreCodes(selectedDomains);
    const groups: Record<string, SubDomain[]> = {};

    for (const sd of subDomainsMetadata) {
      if (!sd.active) continue;
      if (storeCodes.length > 0 && !storeCodes.includes(sd.domainCode)) continue;

      const q = search.toLowerCase();
      if (q) {
        const matchLabel =
          sd.labelEn.toLowerCase().includes(q) ||
          sd.labelFr.toLowerCase().includes(q) ||
          (sd.labelPt?.toLowerCase().includes(q) ?? false) ||
          (sd.labelAr?.toLowerCase().includes(q) ?? false) ||
          sd.code.toLowerCase().includes(q);
        if (!matchLabel) continue;
      }

      if (!groups[sd.domainCode]) groups[sd.domainCode] = [];
      groups[sd.domainCode].push(sd);
    }

    // Sort sub-domains within each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.displayOrder - b.displayOrder);
    }

    return groups;
  }, [subDomainsMetadata, selectedDomains, search]);

  // Auto-expand domains that have search matches
  const domainsWithResults = Object.keys(tree);

  const toggleExpand = (domainCode: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domainCode)) next.delete(domainCode);
      else next.add(domainCode);
      return next;
    });
  };

  const toggleSubDomain = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const selectAllInDomain = (domainCode: string) => {
    const domainSubs = tree[domainCode] ?? [];
    const domainCodes = domainSubs.map((sd) => sd.code);
    const allSelected = domainCodes.every((c) => value.includes(c));

    if (allSelected) {
      // Deselect all in this domain
      onChange(value.filter((c) => !domainCodes.includes(c)));
    } else {
      // Select all in this domain
      const existing = new Set(value);
      for (const c of domainCodes) existing.add(c);
      onChange([...existing]);
    }
  };

  const removeSubDomain = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  // Resolve label for selected chips
  const getChipLabel = (code: string) => {
    const sd = subDomainsMetadata.find((s) => s.code === code);
    if (!sd) return code;
    const domLabel = getDomainLabel(sd.domainCode);
    const sdLabel = getSubDomainLabel(sd, locale);
    return `${domLabel} › ${sdLabel}`;
  };

  if (selectedDomains.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        {t('selectDomainFirst')}
      </p>
    );
  }

  const totalAvailable = Object.values(tree).reduce((sum, arr) => sum + arr.length, 0);

  if (totalAvailable === 0 && !search) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        {t('noSubDomainsAvailable')}
      </p>
    );
  }

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
                onClick={() => removeSubDomain(code)}
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

      {/* Tree view */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {domainsWithResults.length === 0 && search ? (
          <p className="px-4 py-3 text-xs text-gray-400 italic">{t('noSubDomainsMatch')}</p>
        ) : (
          domainsWithResults.map((domainCode) => {
            const subDomains = tree[domainCode];
            const isExpanded = expanded.has(domainCode) || !!search;
            const allSelected = subDomains.every((sd) => value.includes(sd.code));
            const someSelected = subDomains.some((sd) => value.includes(sd.code));

            return (
              <div key={domainCode} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                {/* Domain header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(domainCode)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="flex-1">{getDomainLabel(domainCode)}</span>
                  <span className="text-[10px] text-gray-400">
                    {subDomains.filter((sd) => value.includes(sd.code)).length}/{subDomains.length}
                  </span>
                  {/* Select all toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInDomain(domainCode);
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      allSelected
                        ? 'bg-aris-primary-100 text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    {allSelected ? t('deselectAll') : t('selectAllBtn')}
                  </button>
                </button>

                {/* Sub-domain list */}
                {isExpanded && (
                  <div className="pb-1">
                    {subDomains.map((sd) => {
                      const isSelected = value.includes(sd.code);
                      return (
                        <label
                          key={sd.code}
                          className={`flex cursor-pointer items-center gap-2.5 px-4 py-1.5 pl-9 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                            isSelected ? 'text-aris-primary-700 dark:text-aris-primary-300' : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSubDomain(sd.code)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-aris-primary-600 focus:ring-aris-primary-500 dark:border-gray-600"
                          />
                          <span className="flex-1">{getSubDomainLabel(sd, locale)}</span>
                          {sd.typeEnum && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                              sd.typeEnum === 'VALUE_CHAIN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : sd.typeEnum === 'PATHOLOGY' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : sd.typeEnum === 'ORGANIZATIONAL' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
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
