'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

export function ChartConfig({ config, onChange }: ConfigProps) {
  const t = useTranslations('dashboard');
  const isPie = (config._widgetType as string) === 'PIE';
  const yKeys = (config.yKeys as string[]) ?? [''];
  const colors = (config.colors as string[]) ?? ['#1F4E79'];

  const updateYKey = (idx: number, val: string) => {
    const next = [...yKeys];
    next[idx] = val;
    onChange({ yKeys: next });
  };

  const updateColor = (idx: number, val: string) => {
    const next = [...colors];
    next[idx] = val;
    onChange({ colors: next });
  };

  const addSeries = () => {
    onChange({ yKeys: [...yKeys, ''], colors: [...colors, '#C9A227'] });
  };

  const removeSeries = (idx: number) => {
    onChange({
      yKeys: yKeys.filter((_, i) => i !== idx),
      colors: colors.filter((_, i) => i !== idx),
    });
  };

  if (isPie) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbNameKey')}</label>
          <input
            type="text"
            value={(config.nameKey as string) ?? ''}
            onChange={(e) => onChange({ nameKey: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            placeholder={t('dbPlaceholderCountryDateCount')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbValueKey')}</label>
          <input
            type="text"
            value={(config.valueKey as string) ?? ''}
            onChange={(e) => onChange({ valueKey: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            placeholder={t('dbPlaceholderCountryDateCount')}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={!!config.showLegend} onChange={(e) => onChange({ showLegend: e.target.checked })} className="rounded" />
            {t('dbShowLegend')}
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbXAxisKey')}</label>
        <input
          type="text"
          value={(config.xKey as string) ?? ''}
          onChange={(e) => onChange({ xKey: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          placeholder={t('dbPlaceholderCountryDateCount')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbYAxisSeries')}</label>
        <div className="space-y-2">
          {yKeys.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={k}
                onChange={(e) => updateYKey(i, e.target.value)}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                placeholder={t('dbFieldName')}
              />
              <input
                type="color"
                value={colors[i] ?? '#1F4E79'}
                onChange={(e) => updateColor(i, e.target.value)}
                className="h-8 w-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              {yKeys.length > 1 && (
                <button onClick={() => removeSeries(i)} className="p-1 text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addSeries} className="mt-2 flex items-center gap-1 text-sm text-[#1F4E79] dark:text-[#C9A227] hover:underline">
          <Plus className="h-3.5 w-3.5" /> {t('dbAddSeries')}
        </button>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={!!config.showGrid} onChange={(e) => onChange({ showGrid: e.target.checked })} className="rounded" />
          {t('dbShowGrid')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={!!config.showLegend} onChange={(e) => onChange({ showLegend: e.target.checked })} className="rounded" />
          {t('dbShowLegend')}
        </label>
      </div>
    </div>
  );
}
