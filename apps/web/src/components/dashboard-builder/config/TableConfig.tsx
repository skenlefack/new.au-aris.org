'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  align: 'left' | 'center' | 'right';
}

export function TableConfig({ config, onChange }: ConfigProps) {
  const columns = (config.columns as ColumnDef[]) ?? [];

  const updateColumn = (idx: number, field: keyof ColumnDef, val: string) => {
    const next = columns.map((c, i) => (i === idx ? { ...c, [field]: val } : c));
    onChange({ columns: next });
  };

  const addColumn = () => {
    onChange({ columns: [...columns, { key: '', label: '', align: 'left' }] });
  };

  const removeColumn = (idx: number) => {
    onChange({ columns: columns.filter((_, i) => i !== idx) });
  };

  const t = useTranslations('dashboard');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dbColumns')}</label>
        <div className="space-y-2">
          {columns.map((col, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={col.key}
                onChange={(e) => updateColumn(i, 'key', e.target.value)}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                placeholder={t('dbKey')}
              />
              <input
                type="text"
                value={col.label}
                onChange={(e) => updateColumn(i, 'label', e.target.value)}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                placeholder={t('dbLabel')}
              />
              <select
                value={col.align}
                onChange={(e) => updateColumn(i, 'align', e.target.value)}
                className="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
              >
                <option value="left">{t('dbAlignLeft')}</option>
                <option value="center">{t('dbAlignCenter')}</option>
                <option value="right">{t('dbAlignRight')}</option>
              </select>
              <button onClick={() => removeColumn(i)} className="p-1 text-red-500 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addColumn} className="mt-2 flex items-center gap-1 text-sm text-[#1F4E79] dark:text-[#C9A227] hover:underline">
          <Plus className="h-3.5 w-3.5" /> {t('dbAddColumn')}
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dbMaxRows')}</label>
        <input
          type="number"
          value={(config.maxRows as number) ?? 10}
          onChange={(e) => onChange({ maxRows: Number(e.target.value) })}
          className="w-32 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          min={1}
        />
      </div>
    </div>
  );
}
