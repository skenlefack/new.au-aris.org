'use client';

import React from 'react';
import { X, Plus, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import type { CrossFieldValidationRule, CrossFieldOperator, MultilingualText, FormField } from '../utils/form-schema';

const OPERATORS: { value: CrossFieldOperator; labelEn: string; labelFr: string; symbol: string }[] = [
  { value: 'lessThan', labelEn: 'less than', labelFr: 'inférieur à', symbol: '<' },
  { value: 'lessOrEqual', labelEn: 'less than or equal', labelFr: 'inférieur ou égal à', symbol: '≤' },
  { value: 'greaterThan', labelEn: 'greater than', labelFr: 'supérieur à', symbol: '>' },
  { value: 'greaterOrEqual', labelEn: 'greater or equal', labelFr: 'supérieur ou égal à', symbol: '≥' },
  { value: 'equals', labelEn: 'equals', labelFr: 'égal à', symbol: '=' },
  { value: 'notEquals', labelEn: 'not equal to', labelFr: 'différent de', symbol: '≠' },
];

const COMPARABLE_TYPES = new Set(['number', 'date', 'datetime', 'text', 'calculated']);

function getFieldLabel(field: FormField, locale: string): string {
  return field.label[locale] || field.label.en || field.label.fr || field.code || field.id.slice(0, 8);
}

interface ValidationRulesModalProps {
  onClose: () => void;
}

export function ValidationRulesModal({ onClose }: ValidationRulesModalProps) {
  const t = useTranslations('collecte');
  const locale = useLocaleStore((s) => s.locale);
  const isFr = locale === 'fr';
  const { getSchema, setSchema } = useFormBuilderStore();
  const schema = getSchema();
  const rules = schema.validationRules || [];

  // All comparable fields across all sections
  const allFields = schema.sections
    .flatMap((s) => s.fields)
    .filter((f) => COMPARABLE_TYPES.has(f.type));

  const updateRules = (newRules: CrossFieldValidationRule[]) => {
    setSchema({ ...schema, validationRules: newRules });
  };

  const addRule = () => {
    const newRule: CrossFieldValidationRule = {
      id: crypto.randomUUID(),
      fieldA: allFields[0]?.code || '',
      operator: 'lessThan',
      fieldB: allFields[1]?.code || allFields[0]?.code || '',
      message: { en: '', fr: '' },
      enabled: true,
    };
    updateRules([...rules, newRule]);
  };

  const updateRule = (index: number, data: Partial<CrossFieldValidationRule>) => {
    updateRules(rules.map((r, i) => i === index ? { ...r, ...data } : r));
  };

  const removeRule = (index: number) => {
    updateRules(rules.filter((_, i) => i !== index));
  };

  const autoMessage = (rule: CrossFieldValidationRule): string => {
    const fA = allFields.find((f) => f.code === rule.fieldA);
    const fB = allFields.find((f) => f.code === rule.fieldB);
    if (!fA || !fB) return '';
    const nameA = getFieldLabel(fA, locale);
    const nameB = getFieldLabel(fB, locale);
    const op = OPERATORS.find((o) => o.value === rule.operator);
    if (!op) return '';
    if (isFr) return `"${nameA}" doit être ${op.labelFr} "${nameB}"`;
    return `"${nameA}" must be ${op.labelEn} "${nameB}"`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative mx-4 w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isFr ? 'Règles de validation inter-champs' : 'Cross-field Validation Rules'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isFr
                  ? 'Définissez des contraintes entre les champs du formulaire (ex: date A < date B, morts ≤ effectif)'
                  : 'Define constraints between form fields (e.g., date A < date B, deaths ≤ herd size)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {allFields.length < 2 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {isFr
                ? 'Ajoutez au moins 2 champs comparables (nombre, date, texte) pour créer des règles.'
                : 'Add at least 2 comparable fields (number, date, text) to create rules.'}
            </div>
          )}

          {rules.length === 0 && allFields.length >= 2 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                {isFr ? 'Aucune règle de validation définie' : 'No validation rules defined'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {isFr
                  ? 'Exemples : date de prélèvement < date résultats, nombre de morts ≤ effectif du troupeau'
                  : 'Examples: sample date < results date, deaths ≤ herd size'}
              </p>
            </div>
          )}

          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className={cn(
                'rounded-xl border p-4 space-y-3 transition-colors',
                rule.enabled
                  ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                  : 'border-gray-100 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900',
              )}
            >
              {/* Rule header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">
                  {isFr ? `Règle ${idx + 1}` : `Rule ${idx + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateRule(idx, { enabled: !rule.enabled })}
                    className={cn(
                      'relative h-5 w-9 rounded-full transition-colors',
                      rule.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                      rule.enabled ? 'left-[18px]' : 'left-0.5',
                    )} />
                  </button>
                  <button onClick={() => removeRule(idx)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Field A — Operator — Field B */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <select
                  value={rule.fieldA}
                  onChange={(e) => updateRule(idx, { fieldA: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{isFr ? '— Champ A —' : '— Field A —'}</option>
                  {allFields.map((f) => (
                    <option key={f.id} value={f.code}>{getFieldLabel(f, locale)} ({f.type})</option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(idx, { operator: e.target.value as CrossFieldOperator })}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-center dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.symbol} {isFr ? op.labelFr : op.labelEn}
                    </option>
                  ))}
                </select>

                <select
                  value={rule.fieldB}
                  onChange={(e) => updateRule(idx, { fieldB: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{isFr ? '— Champ B —' : '— Field B —'}</option>
                  {allFields.map((f) => (
                    <option key={f.id} value={f.code}>{getFieldLabel(f, locale)} ({f.type})</option>
                  ))}
                </select>
              </div>

              {/* Error message */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {isFr ? "Message d'erreur" : 'Error message'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = autoMessage(rule);
                      updateRule(idx, { message: { ...rule.message, [locale]: msg, en: rule.message.en || msg } });
                    }}
                    className="text-[10px] text-blue-500 hover:text-blue-600"
                  >
                    {isFr ? 'Auto-générer' : 'Auto-generate'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 mb-0.5 block">EN</span>
                    <input
                      type="text"
                      value={rule.message.en || ''}
                      onChange={(e) => updateRule(idx, { message: { ...rule.message, en: e.target.value } })}
                      placeholder="e.g. Deaths must be ≤ herd size"
                      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 mb-0.5 block">FR</span>
                    <input
                      type="text"
                      value={rule.message.fr || ''}
                      onChange={(e) => updateRule(idx, { message: { ...rule.message, fr: e.target.value } })}
                      placeholder="ex: Les morts doivent être ≤ effectif"
                      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {rule.fieldA && rule.fieldB && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  {autoMessage(rule)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={addRule}
            disabled={allFields.length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-400"
          >
            <Plus className="h-3.5 w-3.5" />
            {isFr ? 'Ajouter une règle' : 'Add rule'}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {rules.length} {isFr ? (rules.length > 1 ? 'règles' : 'règle') : (rules.length === 1 ? 'rule' : 'rules')}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              {isFr ? 'Fermer' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
