'use client';

import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLocationFieldProps {
  levels: number[];
  requiredLevels?: number[];
  value: Record<string, string> | null;
  onChange: (value: Record<string, string> | null) => void;
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Country',
  1: 'Region / Province',
  2: 'District / Department',
  3: 'Sub-district / Commune',
  4: 'Ward / Village',
};

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';

export function AdminLocationField({
  levels,
  requiredLevels = [],
  value,
  onChange,
}: AdminLocationFieldProps) {
  const [selections, setSelections] = useState<Record<string, string>>(value || {});

  useEffect(() => {
    if (value) setSelections(value);
  }, [value]);

  const handleChange = (level: number, val: string) => {
    const updated = { ...selections };
    updated[`level_${level}`] = val;
    // Clear deeper levels
    for (const l of levels) {
      if (l > level) {
        delete updated[`level_${l}`];
      }
    }
    setSelections(updated);
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4" />
        <span>Administrative Location</span>
      </div>
      {levels.map((level) => {
        const isRequired = requiredLevels.includes(level);
        const isDisabled = level > Math.min(...levels) && !selections[`level_${level - 1}`];
        return (
          <div key={level}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {LEVEL_LABELS[level] || `Level ${level}`}
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <select
              value={selections[`level_${level}`] || ''}
              onChange={(e) => handleChange(level, e.target.value)}
              disabled={isDisabled}
              className={cn(inputClass, isDisabled && 'opacity-50 cursor-not-allowed')}
            >
              <option value="">
                {isDisabled ? 'Select parent first...' : `Select ${LEVEL_LABELS[level] || `Level ${level}`}...`}
              </option>
              {/* In production, options would be loaded from the master-data/geo API */}
              {/* For preview purposes, show placeholder options */}
            </select>
          </div>
        );
      })}
      <p className="text-[10px] text-gray-400">
        Location hierarchy cascades from master data
      </p>
    </div>
  );
}
