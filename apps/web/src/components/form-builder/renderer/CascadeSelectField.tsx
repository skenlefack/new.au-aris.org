'use client';

import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@/lib/i18n/translations';
import type { FormField, MultilingualText } from '../utils/form-schema';

const ml = (text?: MultilingualText) => text?.en || text?.fr || '';

interface CascadeLevelConfig {
  label: MultilingualText;
  key: string;
}

interface CascadeOption {
  label: MultilingualText;
  value: string;
  children?: CascadeOption[];
}

interface CascadeSelectFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

const selectClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';

export function CascadeSelectField({ field, value, onChange }: CascadeSelectFieldProps) {
  const t = useTranslations('collecte');
  const levels = (field.properties.levels || []) as CascadeLevelConfig[];
  const options = (field.properties.options || []) as CascadeOption[];

  // Value is Record<levelKey, selectedValue>
  const cascadeValue = (value && typeof value === 'object' && !Array.isArray(value))
    ? value as Record<string, string>
    : {};

  /**
   * For a given level index, resolve the available options by walking the tree
   * based on selections at prior levels.
   */
  const getOptionsForLevel = useCallback(
    (levelIndex: number): CascadeOption[] => {
      let current = options;
      for (let i = 0; i < levelIndex; i++) {
        const levelKey = levels[i]?.key;
        if (!levelKey) return [];
        const selected = cascadeValue[levelKey];
        if (!selected) return [];
        const match = current.find((o) => o.value === selected);
        if (!match || !match.children) return [];
        current = match.children;
      }
      return current;
    },
    [levels, options, cascadeValue],
  );

  const handleLevelChange = useCallback(
    (levelIndex: number, selectedValue: string) => {
      const levelKey = levels[levelIndex]?.key;
      if (!levelKey) return;

      const updated = { ...cascadeValue, [levelKey]: selectedValue };

      // Clear all child level selections when a parent changes
      for (let i = levelIndex + 1; i < levels.length; i++) {
        const childKey = levels[i]?.key;
        if (childKey) delete updated[childKey];
      }

      onChange(updated);
    },
    [levels, cascadeValue, onChange],
  );

  // Pre-compute options for each level
  const levelOptions = useMemo(
    () => levels.map((_, i) => getOptionsForLevel(i)),
    [levels, getOptionsForLevel],
  );

  if (levels.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs text-gray-400">{t('fbNoLevelsCascade')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {levels.map((level, i) => {
        const opts = levelOptions[i];
        const levelKey = level.key;
        const selected = cascadeValue[levelKey] || '';
        // Disable if no options available (parent not selected)
        const disabled = i > 0 && opts.length === 0;

        return (
          <div key={levelKey}>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">
              {ml(level.label) || levelKey}
            </label>
            <select
              value={selected}
              onChange={(e) => handleLevelChange(i, e.target.value)}
              disabled={disabled}
              className={selectClass}
            >
              <option value="">
                {disabled ? t('fbSelectAboveFirst') : `Select ${ml(level.label) || levelKey}...`}
              </option>
              {opts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {ml(opt.label) || opt.value}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
