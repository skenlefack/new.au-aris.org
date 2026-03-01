'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsEditorProps {
  label: string;
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  disabled?: boolean;
  suggestions?: string[];
}

export function StatsEditor({
  label,
  value,
  onChange,
  disabled = false,
  suggestions = ['activeOutbreaks', 'vaccinationCoverage', 'reportsSubmitted', 'activeCampaigns', 'livestockCensus', 'tradeVolume'],
}: StatsEditorProps) {
  const [newKey, setNewKey] = useState('');

  const entries = Object.entries(value);
  const availableSuggestions = suggestions.filter((s) => !(s in value));

  const handleUpdate = (key: string, num: number) => {
    onChange({ ...value, [key]: num });
  };

  const handleRemove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const handleAdd = () => {
    const key = newKey.trim();
    if (key && !(key in value)) {
      onChange({ ...value, [key]: 0 });
      setNewKey('');
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div className="space-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="min-w-[160px] text-xs font-mono text-gray-600 dark:text-gray-400">
              {key}
            </span>
            <input
              type="number"
              value={val}
              onChange={(e) => handleUpdate(key, Number(e.target.value))}
              disabled={disabled}
              className={cn(
                'w-28 rounded border border-gray-200 px-2 py-1 text-right text-sm',
                'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">Select or type...</option>
            {availableSuggestions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Custom key"
            className="w-32 rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newKey.trim()}
            className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
