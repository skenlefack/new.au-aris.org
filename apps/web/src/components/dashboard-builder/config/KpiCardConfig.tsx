'use client';

import React from 'react';

interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

const PRESET_COLORS = ['#1F4E79', '#C9A227', '#2E7D32', '#D32F2F', '#7B1FA2', '#0288D1'];

export function KpiCardConfig({ config, onChange }: ConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
        <input
          type="text"
          value={(config.label as string) ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          placeholder="e.g. Total Outbreaks"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prefix</label>
          <input
            type="text"
            value={(config.prefix as string) ?? ''}
            onChange={(e) => onChange({ prefix: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suffix</label>
          <input
            type="text"
            value={(config.suffix as string) ?? ''}
            onChange={(e) => onChange({ suffix: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Green threshold</label>
          <input
            type="number"
            value={(config.greenThreshold as number) ?? ''}
            onChange={(e) => onChange({ greenThreshold: Number(e.target.value) })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yellow threshold</label>
          <input
            type="number"
            value={(config.yellowThreshold as number) ?? ''}
            onChange={(e) => onChange({ yellowThreshold: Number(e.target.value) })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
        <div className="flex items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${config.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="text"
            value={(config.color as string) ?? '#1F4E79'}
            onChange={(e) => onChange({ color: e.target.value })}
            className="ml-2 w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
            placeholder="#hex"
          />
        </div>
      </div>
    </div>
  );
}
