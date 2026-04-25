'use client';

import React, { useCallback } from 'react';
import { Plus, Trash2, Star, Info } from 'lucide-react';
import { useDomainStore } from '@/lib/stores/domain-store';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TargetFormValue {
  domainCode: string;
  subDomainCode: string | null;
  isPrimary: boolean;
}

interface TargetsSelectorProps {
  value: TargetFormValue[];
  onChange: (targets: TargetFormValue[]) => void;
  /** Maximum number of targets allowed (default 10) */
  max?: number;
  /** Translation function from useTranslations('collecte') */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_TARGETS = 10;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TargetsSelector({ value, onChange, max = MAX_TARGETS, t }: TargetsSelectorProps) {
  const getUserDomainCodes = useDomainStore((s) => s.getUserDomainCodes);
  const getSubDomainsOfDomain = useDomainStore((s) => s.getSubDomainsOfDomain);
  const allDomains = useDomainStore((s) => s.allDomains);

  const accessibleCodes = getUserDomainCodes();

  // Filter DOMAIN_OPTIONS to only accessible ones
  const accessibleDomainOptions = DOMAIN_OPTIONS.filter(
    (d) => accessibleCodes.length === 0 || accessibleCodes.includes(d.value),
  );

  const handleAddTarget = useCallback(() => {
    if (value.length >= max) return;
    const newTarget: TargetFormValue = {
      domainCode: '',
      subDomainCode: null,
      isPrimary: value.length === 0, // first one is primary by default
    };
    onChange([...value, newTarget]);
  }, [value, onChange, max]);

  const handleRemoveTarget = useCallback(
    (index: number) => {
      if (value.length <= 1) return;
      const next = value.filter((_, i) => i !== index);
      // If the removed one was primary, make the first one primary
      if (!next.some((t) => t.isPrimary) && next.length > 0) {
        next[0] = { ...next[0], isPrimary: true };
      }
      onChange(next);
    },
    [value, onChange],
  );

  const handleUpdateTarget = useCallback(
    (index: number, patch: Partial<TargetFormValue>) => {
      const next = value.map((t, i) => {
        if (i !== index) return t;
        const updated = { ...t, ...patch };
        // Reset subDomainCode when domain changes
        if (patch.domainCode !== undefined && patch.domainCode !== t.domainCode) {
          updated.subDomainCode = null;
        }
        return updated;
      });
      onChange(next);
    },
    [value, onChange],
  );

  const handleSetPrimary = useCallback(
    (index: number) => {
      const next = value.map((t, i) => ({
        ...t,
        isPrimary: i === index,
      }));
      onChange(next);
    },
    [value, onChange],
  );

  // Resolve domain label from DOMAIN_OPTIONS or allDomains
  const getDomainLabel = (code: string) => {
    const opt = DOMAIN_OPTIONS.find((d) => d.value === code);
    if (opt) return opt.label;
    const dom = allDomains.find((d) => d.code === code);
    if (dom) return dom.name.en || dom.name.fr || code;
    return code;
  };

  return (
    <div className="space-y-3">
      {/* Help banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-950/30">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {t('targetsHelp')}
        </p>
      </div>

      {/* Target rows */}
      <div className="space-y-2">
        {value.map((target, index) => {
          const subDomains = target.domainCode
            ? getSubDomainsOfDomain(target.domainCode)
            : [];

          return (
            <div
              key={index}
              className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
                target.isPrimary
                  ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:border-[#1F4E79] dark:bg-[#1F4E79]/10'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              {/* Domain select */}
              <div className="flex-1 min-w-[180px]">
                <select
                  value={target.domainCode}
                  onChange={(e) =>
                    handleUpdateTarget(index, { domainCode: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{t('selectDomain')}</option>
                  {accessibleDomainOptions.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-domain select (visible only when domain is selected) */}
              {target.domainCode && (
                <div className="flex-1 min-w-[180px]">
                  <select
                    value={target.subDomainCode ?? ''}
                    onChange={(e) =>
                      handleUpdateTarget(index, {
                        subDomainCode: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">{t('allSubDomains')}</option>
                    {subDomains.map((sd) => (
                      <option key={sd.code} value={sd.code}>
                        {sd.labelEn || sd.labelFr || sd.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Primary toggle (radio) */}
              <button
                type="button"
                onClick={() => handleSetPrimary(index)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  target.isPrimary
                    ? 'bg-[#C9A227] text-white'
                    : 'border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500'
                }`}
                title={target.isPrimary ? t('primaryTarget') : t('setPrimary')}
              >
                <Star
                  className={`h-3.5 w-3.5 ${target.isPrimary ? 'fill-current' : ''}`}
                />
                {target.isPrimary ? t('primary') : t('setPrimary')}
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleRemoveTarget(index)}
                disabled={value.length <= 1}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-red-950/30 transition-colors"
                title={t('removeTarget')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={handleAddTarget}
        disabled={value.length >= max}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {t('addTarget')} ({value.length}/{max})
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Target badges for list views                                       */
/* ------------------------------------------------------------------ */

interface TargetBadgeProps {
  target: { domainCode: string; subDomainCode?: string | null; isPrimary?: boolean };
}

export function TargetBadge({ target }: TargetBadgeProps) {
  const domainLabel =
    DOMAIN_OPTIONS.find((d) => d.value === target.domainCode)?.label ?? target.domainCode;
  const subDomainsMetadata = useDomainStore((s) => s.subDomainsMetadata);

  let label = domainLabel;
  if (target.subDomainCode) {
    const sd = subDomainsMetadata.find((s) => s.code === target.subDomainCode);
    const sdLabel = sd?.labelEn || sd?.labelFr || target.subDomainCode;
    label = `${domainLabel} > ${sdLabel}`;
  }

  if (target.isPrimary) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#1F4E79] px-2 py-0.5 text-[10px] font-medium text-white">
        <Star className="h-2.5 w-2.5 fill-current" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[#1F4E79] px-2 py-0.5 text-[10px] font-medium text-[#1F4E79] dark:border-[#1F4E79]/60 dark:text-[#1F4E79]/80">
      {label}
    </span>
  );
}

/** Render a list of target badges */
export function TargetBadges({ targets }: { targets: TargetBadgeProps['target'][] }) {
  if (!targets || targets.length === 0) return null;
  // Show primary first, then secondaries
  const sorted = [...targets].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {sorted.map((tgt, i) => (
        <TargetBadge key={`${tgt.domainCode}-${tgt.subDomainCode}-${i}`} target={tgt} />
      ))}
    </span>
  );
}
