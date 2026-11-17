'use client';

import React from 'react';
import { CopyCheck, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import type { DuplicateDetectionSettings, FormField, FormSettings } from '../utils/form-schema';

/** Field types that can identify a herd/entity. Files, layout blocks and repeaters cannot. */
const KEY_TYPES = new Set([
  'text', 'number', 'email', 'phone', 'select', 'multi-select', 'radio', 'checkbox', 'toggle',
  'master-data-select', 'cascade-select', 'date', 'datetime', 'admin-location', 'calculated', 'auto-id', 'lookup',
]);
const TOLERANCE_TYPES = new Set(['number', 'calculated', 'date', 'datetime']);
const GPS_TYPES = new Set(['geo-point', 'geo-selector']);

function labelOf(f: FormField, locale: string): string {
  return f.label?.[locale] || f.label?.en || f.label?.fr || f.code || f.id.slice(0, 8);
}

export function DuplicateRulesModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('duplicates');
  const locale = useLocaleStore((s) => s.locale);
  const { getSchema, setSchema } = useFormBuilderStore();
  const schema = getSchema();
  const settings = (schema.settings ?? {}) as FormSettings;
  const raw = settings.duplicateDetection as DuplicateDetectionSettings | boolean | undefined;
  const rule: DuplicateDetectionSettings = raw && typeof raw === 'object' ? raw : { enabled: false, fields: [] };

  const fields = schema.sections.flatMap((s) => s.fields);
  const keyFields = fields.filter((f) => KEY_TYPES.has(f.type));
  const gpsFields = fields.filter((f) => GPS_TYPES.has(f.type));
  const selected = new Set(rule.fields ?? []);
  const active = rule.enabled && !!rule.action && selected.size > 0;

  const update = (patch: Partial<DuplicateDetectionSettings>) => {
    const next = { ...rule, ...patch };
    // A rule is saved with an action as soon as it is edited here, so it becomes effective.
    if (!next.action) next.action = 'warn';
    setSchema({ ...schema, settings: { ...settings, duplicateDetection: next } as FormSettings });
  };

  const toggleField = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code); else next.add(code);
    // Keep the order of the form.
    update({ fields: keyFields.map((f) => f.code).filter((c) => next.has(c)) });
  };

  const setTolerance = (code: string, value: string) => {
    const n = Math.max(0, Number(value) || 0);
    const tol = { ...(rule.tolerances ?? {}) };
    if (n > 0) tol[code] = n; else delete tol[code];
    update({ tolerances: tol });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <CopyCheck className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ruleTitle')}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{t('ruleSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" aria-label={t('close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('ruleExplain')}</p>
          </div>

          {/* Enable + action */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <button
                type="button"
                role="switch"
                aria-checked={rule.enabled}
                onClick={() => update({ enabled: !rule.enabled })}
                className={cn('relative h-5 w-9 rounded-full transition-colors', rule.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600')}
              >
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', rule.enabled ? 'left-[18px]' : 'left-0.5')} />
              </button>
              {t('ruleEnabled')}
            </label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {(['warn', 'block'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update({ action: a })}
                  className={cn('rounded-md px-3 py-1 text-xs font-medium',
                    (rule.action ?? 'warn') === a ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400')}
                >
                  {a === 'warn' ? t('actionWarn') : t('actionBlock')}
                </button>
              ))}
            </div>
          </div>
          <p className="-mt-3 text-xs text-gray-500 dark:text-gray-400">
            {(rule.action ?? 'warn') === 'warn' ? t('actionWarnHelp') : t('actionBlockHelp')}
          </p>

          {/* Key fields */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('keyFields')}</h3>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('keyFieldsHelp')}</p>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              {keyFields.map((f) => {
                const on = selected.has(f.code);
                const isDate = f.type === 'date' || f.type === 'datetime';
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input type="checkbox" checked={on} onChange={() => toggleField(f.code)} className="h-4 w-4 rounded border-gray-300" />
                      <span className="truncate">{labelOf(f, locale)}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{f.type}</span>
                    </label>
                    {on && TOLERANCE_TYPES.has(f.type) && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        {t('tolerance')} ±
                        <input
                          type="number"
                          min={0}
                          value={rule.tolerances?.[f.code] ?? 0}
                          onChange={(e) => setTolerance(f.code, e.target.value)}
                          className="h-7 w-16 rounded border border-gray-200 px-1.5 text-right dark:border-gray-700 dark:bg-gray-800"
                        />
                        {isDate ? t('days') : ''}
                      </label>
                    )}
                  </li>
                );
              })}
              {keyFields.length === 0 && <li className="px-3 py-4 text-center text-xs italic text-gray-400">{t('noKeyFields')}</li>}
            </ul>
          </div>

          {/* GPS + scope */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('gpsTitle')}</h3>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('gpsHelp')}</p>
              <div className="flex items-center gap-2">
                <select
                  value={rule.gpsField ?? ''}
                  onChange={(e) => update({ gpsField: e.target.value || undefined, gpsMeters: e.target.value ? (rule.gpsMeters || 100) : undefined })}
                  className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{t('gpsNone')}</option>
                  {gpsFields.map((f) => <option key={f.id} value={f.code}>{labelOf(f, locale)}</option>)}
                </select>
                {rule.gpsField && (
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    ≤
                    <input
                      type="number"
                      min={1}
                      value={rule.gpsMeters ?? 100}
                      onChange={(e) => update({ gpsMeters: Math.max(1, Number(e.target.value) || 100) })}
                      className="h-8 w-20 rounded border border-gray-200 px-1.5 text-right dark:border-gray-700 dark:bg-gray-800"
                    />
                    m
                  </label>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('scopeTitle')}</h3>
              <label className="mt-2 flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={!!rule.sameCollectorOnly}
                  onChange={(e) => update({ sameCollectorOnly: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span>
                  {t('sameCollectorOnly')}
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{t('sameCollectorHelp')}</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <span className={cn('text-xs font-medium', active ? 'text-green-700 dark:text-green-400' : 'text-gray-500')}>
            {active ? t('statusActive', { count: selected.size }) : t('statusInactive')}
          </span>
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
}
