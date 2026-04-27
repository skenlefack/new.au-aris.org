'use client';

import React from 'react';

interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

export function GaugeConfig({ config, onChange }: ConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target value</label>
        <input
          type="number"
          value={(config.target as number) ?? 100}
          onChange={(e) => onChange({ target: Number(e.target.value) })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
        <input
          type="text"
          value={(config.unit as string) ?? '%'}
          onChange={(e) => onChange({ unit: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          placeholder="%"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variant</label>
        <select
          value={(config.variant as string) ?? 'circular'}
          onChange={(e) => onChange({ variant: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="circular">Circular</option>
          <option value="linear">Linear</option>
        </select>
      </div>
    </div>
  );
}
