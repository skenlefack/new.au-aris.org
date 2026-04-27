'use client';

import React from 'react';

interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

export function AlertFeedConfig({ config, onChange }: ConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max items to display</label>
        <input
          type="number"
          value={(config.maxItems as number) ?? 5}
          onChange={(e) => onChange({ maxItems: Number(e.target.value) })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          min={1}
          max={50}
        />
      </div>
    </div>
  );
}
