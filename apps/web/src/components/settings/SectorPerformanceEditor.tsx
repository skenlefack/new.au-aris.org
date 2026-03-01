'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SectorPerformanceEditorProps {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  disabled?: boolean;
}

const SECTOR_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'vaccination', label: 'Vaccination Coverage', color: '#C62828' },
  { key: 'fisheries', label: 'Fisheries & Aquaculture', color: '#00838F' },
  { key: 'wildlife', label: 'Wildlife & Biodiversity', color: '#2E7D32' },
  { key: 'governance', label: 'Governance & Capacities', color: '#6B21A8' },
  { key: 'dataQuality', label: 'Data Quality', color: '#F57F17' },
  { key: 'analytics', label: 'Analytics Readiness', color: '#1565C0' },
];

export function SectorPerformanceEditor({
  value,
  onChange,
  disabled = false,
}: SectorPerformanceEditorProps) {
  const handleUpdate = (key: string, num: number) => {
    const clamped = Math.max(0, Math.min(100, num));
    onChange({ ...value, [key]: clamped });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Sector Performance
      </label>
      <div className="space-y-3">
        {SECTOR_CONFIG.map(({ key, label, color }) => {
          const score = value[key] ?? 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {label}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => handleUpdate(key, Number(e.target.value))}
                    min={0}
                    max={100}
                    disabled={disabled}
                    className={cn(
                      'w-16 rounded border border-gray-200 px-2 py-0.5 text-right text-xs',
                      'dark:border-gray-700 dark:bg-gray-900 dark:text-white',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
