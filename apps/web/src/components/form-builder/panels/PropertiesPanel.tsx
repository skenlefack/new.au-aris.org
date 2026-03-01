'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { getFieldTypeDefinition, MASTER_DATA_TYPES } from '../utils/field-types';
import type { FormField, FormSection, MultilingualText, FieldCondition, FieldConditionRule } from '../utils/form-schema';
import { generateCodeFromLabel } from '../utils/code-generator';

type Tab = 'general' | 'validation' | 'data-source' | 'conditions' | 'appearance';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'validation', label: 'Validation' },
  { key: 'data-source', label: 'Data' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'appearance', label: 'Layout' },
];

// ---- Multilingual inline input ----
function MLInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: MultilingualText;
  onChange: (v: MultilingualText) => void;
  placeholder?: string;
}) {
  const [lang, setLang] = useState<'en' | 'fr' | 'pt' | 'ar'>('en');
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <div className="flex gap-0.5 mb-1">
        {(['en', 'fr', 'pt', 'ar'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
              lang === l
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value[lang] ?? ''}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        placeholder={placeholder}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </div>
  );
}

// ---- Field Properties ----
function FieldProperties({ field }: { field: FormField }) {
  const { updateField, getSchema } = useFormBuilderStore();
  const [tab, setTab] = useState<Tab>('general');

  const update = (data: Partial<FormField>) => updateField(field.id, data);
  const schema = getSchema();
  const allFields = schema.sections.flatMap((s) => s.fields).filter((f) => f.id !== field.id);
  const typeDef = getFieldTypeDefinition(field.type);

  const showDataSource = ['select', 'multi-select', 'radio', 'checkbox', 'master-data-select', 'form-data-select', 'cascade-select'].includes(field.type);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {typeDef?.icon && <typeDef.icon className="h-4 w-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {typeDef?.label || field.type}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
        {TABS.filter((t) => t.key !== 'data-source' || showDataSource).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors',
              tab === t.key
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'general' && (
          <>
            <MLInput
              label="Label"
              value={field.label}
              onChange={(label) => {
                const code = field.code || generateCodeFromLabel(label);
                update({ label, ...(field.code ? {} : { code }) });
              }}
              placeholder="Field label..."
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Code</label>
              <input
                type="text"
                value={field.code}
                onChange={(e) => update({ code: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="field_code"
              />
            </div>
            <MLInput
              label="Help Text"
              value={field.helpText || {}}
              onChange={(helpText) => update({ helpText })}
              placeholder="Help text..."
            />
            <MLInput
              label="Placeholder"
              value={field.placeholder || {}}
              onChange={(placeholder) => update({ placeholder })}
              placeholder="Placeholder..."
            />
            <div className="space-y-2 pt-2">
              <ToggleRow label="Required" checked={field.required} onChange={(required) => update({ required })} />
              <ToggleRow label="Read Only" checked={field.readOnly} onChange={(readOnly) => update({ readOnly })} />
              <ToggleRow label="Hidden" checked={field.hidden} onChange={(hidden) => update({ hidden })} />
            </div>
          </>
        )}

        {tab === 'validation' && (
          <>
            {['text', 'textarea', 'email', 'url', 'phone'].includes(field.type) && (
              <>
                <NumberInput
                  label="Min Length"
                  value={field.validation.minLength}
                  onChange={(minLength) => update({ validation: { ...field.validation, minLength } })}
                />
                <NumberInput
                  label="Max Length"
                  value={field.validation.maxLength}
                  onChange={(maxLength) => update({ validation: { ...field.validation, maxLength } })}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Pattern (Regex)</label>
                  <input
                    type="text"
                    value={field.validation.pattern || ''}
                    onChange={(e) => update({ validation: { ...field.validation, pattern: e.target.value || undefined } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="^[A-Z].*"
                  />
                </div>
              </>
            )}
            {field.type === 'number' && (
              <>
                <NumberInput label="Min" value={field.validation.min} onChange={(min) => update({ validation: { ...field.validation, min } })} />
                <NumberInput label="Max" value={field.validation.max} onChange={(max) => update({ validation: { ...field.validation, max } })} />
                <NumberInput label="Step" value={field.validation.step} onChange={(step) => update({ validation: { ...field.validation, step } })} />
                <NumberInput label="Decimals" value={field.validation.decimals} onChange={(decimals) => update({ validation: { ...field.validation, decimals } })} />
              </>
            )}
            {['date', 'datetime', 'date-range'].includes(field.type) && (
              <>
                <ToggleRow label="Disable Future" checked={!!field.validation.disableFuture} onChange={(disableFuture) => update({ validation: { ...field.validation, disableFuture } })} />
                <ToggleRow label="Disable Past" checked={!!field.validation.disablePast} onChange={(disablePast) => update({ validation: { ...field.validation, disablePast } })} />
              </>
            )}
            {['file-upload', 'image'].includes(field.type) && (
              <>
                <NumberInput label="Max Files" value={field.validation.maxFiles} onChange={(maxFiles) => update({ validation: { ...field.validation, maxFiles } })} />
                <NumberInput label="Max Size (bytes)" value={field.validation.maxSize} onChange={(maxSize) => update({ validation: { ...field.validation, maxSize } })} />
              </>
            )}
            <MLInput
              label="Custom Error Message"
              value={field.validation.customMessage || {}}
              onChange={(customMessage) => update({ validation: { ...field.validation, customMessage } })}
              placeholder="Error message..."
            />
          </>
        )}

        {tab === 'data-source' && showDataSource && (
          <>
            {field.type === 'master-data-select' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Master Data Type</label>
                  <select
                    value={(field.properties.masterDataType as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, masterDataType: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select type...</option>
                    {MASTER_DATA_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <ToggleRow
                  label="Multiple Selection"
                  checked={!!field.properties.multiple}
                  onChange={(multiple) => update({ properties: { ...field.properties, multiple } })}
                />
                <ToggleRow
                  label="Searchable"
                  checked={field.properties.searchable !== false}
                  onChange={(searchable) => update({ properties: { ...field.properties, searchable } })}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cascade Source (parent field)</label>
                  <select
                    value={(field.properties.cascadeSource as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, cascadeSource: e.target.value || undefined } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">None (independent)</option>
                    {allFields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label.en || f.code || f.id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cascade Param</label>
                  <input
                    type="text"
                    value={(field.properties.cascadeParam as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, cascadeParam: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="e.g. groupId"
                  />
                </div>
              </>
            )}

            {['select', 'multi-select', 'radio', 'checkbox'].includes(field.type) && (
              <StaticOptionsEditor
                options={(field.properties.options as Array<{ label: MultilingualText; value: string }>) || []}
                onChange={(options) => update({ properties: { ...field.properties, options } })}
              />
            )}
          </>
        )}

        {tab === 'conditions' && (
          <ConditionsEditor
            conditions={field.conditions}
            allFields={allFields}
            onChange={(conditions) => update({ conditions })}
          />
        )}

        {tab === 'appearance' && (
          <>
            <NumberInput
              label="Column"
              value={field.column}
              onChange={(column) => update({ column: column || 1 })}
            />
            <NumberInput
              label="Column Span"
              value={field.columnSpan}
              onChange={(columnSpan) => update({ columnSpan: columnSpan || 1 })}
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">CSS Class</label>
              <input
                type="text"
                value={(field.properties.cssClass as string) || ''}
                onChange={(e) => update({ properties: { ...field.properties, cssClass: e.target.value } })}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="e.g. highlight-field"
              />
            </div>
            {field.type === 'textarea' && (
              <NumberInput
                label="Rows"
                value={field.properties.rows as number}
                onChange={(rows) => update({ properties: { ...field.properties, rows: rows || 4 } })}
              />
            )}
            {field.type === 'number' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Unit</label>
                <input
                  type="text"
                  value={(field.properties.unit as string) || ''}
                  onChange={(e) => update({ properties: { ...field.properties, unit: e.target.value } })}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="e.g. kg, heads, doses"
                />
              </div>
            )}
            {field.type === 'calculated' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Formula</label>
                <input
                  type="text"
                  value={(field.properties.formula as string) || ''}
                  onChange={(e) => update({ properties: { ...field.properties, formula: e.target.value } })}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="e.g. {deaths} / {cases} * 100"
                />
                <p className="text-[10px] text-gray-400">Use {'{field_code}'} to reference other fields</p>
              </div>
            )}
            {field.type === 'auto-id' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Prefix</label>
                  <input
                    type="text"
                    value={(field.properties.prefix as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, prefix: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="e.g. OBR-"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Format</label>
                  <input
                    type="text"
                    value={(field.properties.format as string) || ''}
                    onChange={(e) => update({ properties: { ...field.properties, format: e.target.value } })}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="{YYYY}-{SEQ:5}"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Section Properties ----
function SectionProperties({ section }: { section: FormSection }) {
  const { updateSection } = useFormBuilderStore();
  const update = (data: Partial<FormSection>) => updateSection(section.id, data);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Section Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MLInput
          label="Section Name"
          value={section.name}
          onChange={(name) => update({ name })}
          placeholder="Section name..."
        />
        <MLInput
          label="Description"
          value={section.description || {}}
          onChange={(description) => update({ description })}
          placeholder="Section description..."
        />
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Columns</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => update({ columns: n })}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium',
                  section.columns === n
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Color</label>
          <input
            type="color"
            value={section.color || '#3B82F6'}
            onChange={(e) => update({ color: e.target.value })}
            className="h-8 w-full rounded-md border border-gray-200 dark:border-gray-700"
          />
        </div>
        <div className="space-y-2">
          <ToggleRow label="Collapsible" checked={section.isCollapsible} onChange={(isCollapsible) => update({ isCollapsible })} />
          <ToggleRow label="Default Collapsed" checked={section.isCollapsed} onChange={(isCollapsed) => update({ isCollapsed })} />
          <ToggleRow
            label="Repeatable"
            checked={section.isRepeatable}
            onChange={(isRepeatable) => update({ isRepeatable })}
          />
        </div>
        {section.isRepeatable && (
          <>
            <NumberInput
              label="Min Repeats"
              value={section.repeatMin}
              onChange={(repeatMin) => update({ repeatMin })}
            />
            <NumberInput
              label="Max Repeats"
              value={section.repeatMax}
              onChange={(repeatMax) => update({ repeatMax })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---- Static Options Editor ----
function StaticOptionsEditor({
  options,
  onChange,
}: {
  options: Array<{ label: MultilingualText; value: string }>;
  onChange: (options: Array<{ label: MultilingualText; value: string }>) => void;
}) {
  const addOption = () => {
    onChange([...options, { label: { en: '' }, value: `option_${options.length + 1}` }]);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, data: Partial<{ label: MultilingualText; value: string }>) => {
    onChange(options.map((opt, i) => (i === index ? { ...opt, ...data } : opt)));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Options</label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={opt.label.en || ''}
            onChange={(e) => updateOption(i, { label: { ...opt.label, en: e.target.value } })}
            placeholder="Label"
            className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={opt.value}
            onChange={(e) => updateOption(i, { value: e.target.value })}
            placeholder="Value"
            className="w-24 rounded-md border border-gray-200 px-2 py-1 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={() => removeOption(i)}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="w-full rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500"
      >
        + Add option
      </button>
    </div>
  );
}

// ---- Conditions Editor ----
const CONDITION_TYPES: { value: FieldCondition['type']; label: string }[] = [
  { value: 'visibility', label: 'Show/Hide' },
  { value: 'required', label: 'Required' },
  { value: 'readOnly', label: 'Read Only' },
  { value: 'value', label: 'Set Value' },
];

const CONDITION_ACTIONS: Record<FieldCondition['type'], { value: FieldCondition['action']; label: string }[]> = {
  visibility: [{ value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }],
  required: [{ value: 'setRequired', label: 'Make Required' }],
  readOnly: [{ value: 'enable', label: 'Enable' }, { value: 'disable', label: 'Disable' }],
  value: [{ value: 'setValue', label: 'Set Value' }],
};

const OPERATORS: { value: FieldConditionRule['operator']; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '≠' },
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Not contains' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'greaterOrEqual', label: '≥' },
  { value: 'lessOrEqual', label: '≤' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
  { value: 'isTrue', label: 'Is true' },
  { value: 'isFalse', label: 'Is false' },
  { value: 'in', label: 'In list' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
];

function ConditionsEditor({
  conditions,
  allFields,
  onChange,
}: {
  conditions: FieldCondition[];
  allFields: FormField[];
  onChange: (conditions: FieldCondition[]) => void;
}) {
  const addCondition = () => {
    const newCondition: FieldCondition = {
      id: crypto.randomUUID(),
      type: 'visibility',
      action: 'show',
      logic: 'all',
      rules: [{
        field: allFields[0]?.id || '',
        operator: 'equals',
        value: '',
      }],
    };
    onChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, data: Partial<FieldCondition>) => {
    onChange(conditions.map((c, i) => i === index ? { ...c, ...data } : c));
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const addRule = (condIndex: number) => {
    const cond = conditions[condIndex];
    updateCondition(condIndex, {
      rules: [...cond.rules, { field: allFields[0]?.id || '', operator: 'equals', value: '' }],
    });
  };

  const updateRule = (condIndex: number, ruleIndex: number, data: Partial<FieldConditionRule>) => {
    const cond = conditions[condIndex];
    updateCondition(condIndex, {
      rules: cond.rules.map((r, i) => i === ruleIndex ? { ...r, ...data } : r),
    });
  };

  const removeRule = (condIndex: number, ruleIndex: number) => {
    const cond = conditions[condIndex];
    updateCondition(condIndex, {
      rules: cond.rules.filter((_, i) => i !== ruleIndex),
    });
  };

  const noValueOperators = ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'];

  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          No conditions. This field is always visible.
        </p>
      )}
      {conditions.map((cond, ci) => {
        const availableActions = CONDITION_ACTIONS[cond.type] || [];
        return (
          <div key={cond.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Condition {ci + 1}</span>
              <button onClick={() => removeCondition(ci)} className="text-gray-400 hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={cond.type}
                onChange={(e) => {
                  const type = e.target.value as FieldCondition['type'];
                  const actions = CONDITION_ACTIONS[type] || [];
                  updateCondition(ci, { type, action: actions[0]?.value || 'show' });
                }}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {CONDITION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={cond.action}
                onChange={(e) => updateCondition(ci, { action: e.target.value as FieldCondition['action'] })}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {availableActions.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">When</span>
              <select
                value={cond.logic}
                onChange={(e) => updateCondition(ci, { logic: e.target.value as 'all' | 'any' })}
                className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">ALL rules match</option>
                <option value="any">ANY rule matches</option>
              </select>
            </div>

            {cond.rules.map((rule, ri) => (
              <div key={ri} className="flex items-center gap-1">
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(ci, ri, { field: e.target.value })}
                  className="flex-1 min-w-0 rounded border border-gray-200 px-1.5 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Field...</option>
                  {allFields.map((f) => (
                    <option key={f.id} value={f.id}>{f.label.en || f.code || f.id.slice(0, 8)}</option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(ci, ri, { operator: e.target.value as FieldConditionRule['operator'] })}
                  className="w-16 rounded border border-gray-200 px-1 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {!noValueOperators.includes(rule.operator) && (
                  <input
                    type="text"
                    value={String(rule.value ?? '')}
                    onChange={(e) => updateRule(ci, ri, { value: e.target.value })}
                    placeholder="Value"
                    className="w-16 rounded border border-gray-200 px-1.5 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                )}
                {cond.rules.length > 1 && (
                  <button onClick={() => removeRule(ci, ri)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => addRule(ci)}
              className="text-[11px] text-blue-500 hover:text-blue-600"
            >
              + Add rule
            </button>
          </div>
        );
      })}
      <button
        onClick={addCondition}
        className="w-full rounded-md border border-dashed border-gray-300 py-2 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-1"
      >
        <Plus className="h-3 w-3" />
        Add condition
      </button>
    </div>
  );
}

// ---- Small helpers ----
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </div>
  );
}

// ---- Main Properties Panel ----
export function PropertiesPanel() {
  const { selectedFieldId, selectedSectionId, getSchema, clearSelection } = useFormBuilderStore();
  const schema = getSchema();

  let selectedField: FormField | null = null;
  let selectedSection: FormSection | null = null;

  if (selectedFieldId) {
    for (const section of schema.sections) {
      const field = section.fields.find((f) => f.id === selectedFieldId);
      if (field) {
        selectedField = field;
        break;
      }
    }
  }

  if (selectedSectionId) {
    selectedSection = schema.sections.find((s) => s.id === selectedSectionId) || null;
  }

  if (!selectedField && !selectedSection) {
    return (
      <div className="flex h-full w-[320px] flex-shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-gray-50/50 px-6 text-center dark:border-gray-700 dark:bg-gray-900/50">
        <div className="text-gray-300 dark:text-gray-600">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Select a field or section to edit its properties
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[320px] flex-shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Close button */}
      <button
        onClick={clearSelection}
        className="absolute right-2 top-2 z-10 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {selectedField ? (
        <FieldProperties field={selectedField} />
      ) : selectedSection ? (
        <SectionProperties section={selectedSection} />
      ) : null}
    </div>
  );
}
