'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, Search, Save, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/data/countries-config';

// ─── Reusable Searchable Dropdown ────────────────────────────────────────────

function SearchableDropdown({ value, onChange, options, placeholder, required, className }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      >
        <span className={selectedLabel ? 'text-gray-900 dark:text-white truncate' : 'text-gray-400'}>
          {selectedLabel || placeholder || '-- Select --'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {required && !value && <input type="text" required value="" className="sr-only" tabIndex={-1} onChange={() => {}} />}

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="sticky top-0 border-b border-gray-100 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm focus:border-fuchsia-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                autoFocus
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">No results</div>
          ) : filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn(
                'flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800',
                o.value === value && 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/20 dark:text-fuchsia-400',
              )}
            >
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
import {
  usePaidReferentials,
  useCreatePaidRef,
  useUpdatePaidRef,
  useDeletePaidRef,
  type PaidRefCategory,
  type PaidReferentialItem,
} from '@/lib/api/ref-data-hooks';

// ─── Entity Definitions ──────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'country-select' | 'paid-select' | 'single-country';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Grid column span (1, 2 or 3). Default 1. */
  colSpan?: number;
}

interface EntityDef {
  key: string;
  label: string;
  labelFr: string;
  icon: string;
  category: PaidRefCategory;
  fields: FieldDef[];
  displayLabel: (item: PaidReferentialItem) => string;
  displaySub: (item: PaidReferentialItem) => string;
  parentFilterKey?: string;
  parentFilterLabel?: string;
}

const ENTITIES: EntityDef[] = [
  {
    key: 'projects', label: 'Projects', labelFr: 'Projets', icon: '\ud83d\udccb',
    category: 'PAID_PROJECT',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. ANGR', colSpan: 1 },
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Project full title', colSpan: 1 },
      { key: 'type', label: 'Type', type: 'select', required: true, colSpan: 1, options: [
        { value: 'single_country', label: 'Single Country' },
        { value: 'multiple_countries', label: 'Multiple Countries' },
      ]},
      { key: 'countries', label: 'Countries', type: 'country-select', required: true, colSpan: 3 },
    ],
    displayLabel: (i) => `${i.code} — ${i.title || ''}`,
    displaySub: (i) => `Type: ${i.type || '-'} | Countries: ${Array.isArray(i.countries) ? (i.countries as string[]).join(', ') : '-'}`,
  },
  {
    key: 'logframes', label: 'Log Frames (AMERT)', labelFr: 'Cadres logiques', icon: '\ud83c\udfaf',
    category: 'PAID_LOGFRAME',
    parentFilterKey: 'project', parentFilterLabel: 'Project',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1' },
      { key: 'project_code', label: 'Project', type: 'paid-select', required: true, colSpan: 2 },
      { key: 'label', label: 'Label', type: 'textarea', required: true, placeholder: 'Log frame description' },
    ],
    displayLabel: (i) => `${i.code} — ${(i.label || '').slice(0, 80)}`,
    displaySub: (i) => `Project: ${i.project_code || '-'}`,
  },
  {
    key: 'lf-activities', label: 'Activities', labelFr: 'Activites', icon: '\u26a1',
    category: 'PAID_LF_ACTIVITY',
    parentFilterKey: 'logframe', parentFilterLabel: 'Log Frame',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01' },
      { key: 'logframe_code', label: 'Log Frame', type: 'paid-select', required: true, colSpan: 2 },
      { key: 'label', label: 'Label', type: 'textarea', required: true, placeholder: 'Activity description' },
    ],
    displayLabel: (i) => `${i.code} — ${(i.label || '').slice(0, 80)}`,
    displaySub: (i) => `Log Frame: ${i.logframe_code || '-'}`,
  },
  {
    key: 'subactivities', label: 'Sub-Activities', labelFr: 'Sous-activites', icon: '\ud83d\udccc',
    category: 'PAID_SUBACTIVITY',
    parentFilterKey: 'activity', parentFilterLabel: 'Activity',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01.01' },
      { key: 'activity_code', label: 'Activity', type: 'paid-select', required: true, colSpan: 2 },
      { key: 'label', label: 'Label', type: 'textarea', required: true, placeholder: 'Sub-activity description' },
      { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', placeholder: 'e.g. Number of MOUs' },
    ],
    displayLabel: (i) => `${i.code} — ${(i.label || '').slice(0, 80)}`,
    displaySub: (i) => `Activity: ${i.activity_code || '-'} | Unit: ${i.unit_of_measure || '-'}`,
  },
  {
    key: 'paid-activities', label: 'PAID Activities', labelFr: 'Activites PAID', icon: '\ud83d\udcca',
    category: 'PAID_PAID_ACTIVITY',
    parentFilterKey: 'subactivity', parentFilterLabel: 'Sub-Activity',
    fields: [
      { key: 'subactivity_code', label: 'Sub-Activity', type: 'paid-select', required: true, colSpan: 2 },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01.01_PA' },
      { key: 'label', label: 'Label', type: 'text', required: true, placeholder: 'e.g. Training/sensitization', colSpan: 2 },
      { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', placeholder: 'e.g. persons, report' },
    ],
    displayLabel: (i) => `${i.code} — ${i.label || ''}`,
    displaySub: (i) => `Sub-Activity: ${i.subactivity_code || '-'} | Unit: ${i.unit_of_measure || '-'}`,
  },
  {
    key: 'breakdown-fields', label: 'Breakdown Fields', labelFr: 'Champs de ventilation', icon: '\ud83d\udd27',
    category: 'PAID_BREAKDOWN_FIELD',
    parentFilterKey: 'paid_activity', parentFilterLabel: 'PAID Activity code',
    fields: [
      { key: 'paid_activity_code', label: 'PAID Activity', type: 'paid-select', required: true },
      { key: 'field_code', label: 'Field Code', type: 'text', required: true, placeholder: 'e.g. n_female_trained' },
      { key: 'field_label', label: 'Field Label', type: 'text', required: true, placeholder: 'e.g. Number of females trained' },
      { key: 'field_type', label: 'Field Type', type: 'select', required: true, options: [
        { value: 'number', label: 'Number' }, { value: 'text', label: 'Text' },
        { value: 'textarea', label: 'Textarea' }, { value: 'select', label: 'Select' },
        { value: 'select_multiple', label: 'Select Multiple' }, { value: 'date', label: 'Date' },
      ]},
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '0' },
      { key: 'is_required', label: 'Required', type: 'boolean' },
    ],
    displayLabel: (i) => `${i.field_code || ''} — ${i.field_label || ''}`,
    displaySub: (i) => `PAID Activity: ${i.paid_activity_code || '-'} | Type: ${i.field_type || '-'}`,
  },
  {
    key: 'executive-partners', label: 'Executive Partners', labelFr: 'Partenaires executifs', icon: '\ud83c\udfdb',
    category: 'PAID_EXEC_PARTNER',
    parentFilterKey: 'project', parentFilterLabel: 'Project',
    fields: [
      { key: 'project_code', label: 'Project', type: 'paid-select', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. AU-IBAR', colSpan: 2 },
    ],
    displayLabel: (i) => i.name || '',
    displaySub: (i) => `Project: ${i.project_code || '-'}`,
  },
  {
    key: 'impl-partners-intl', label: 'Partners (International)', labelFr: 'Partenaires internationaux', icon: '\ud83c\udf0d',
    category: 'PAID_IMPL_PARTNER_INTL',
    parentFilterKey: 'project', parentFilterLabel: 'Project',
    fields: [
      { key: 'project_code', label: 'Project', type: 'paid-select', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Partner organization name', colSpan: 2 },
    ],
    displayLabel: (i) => i.name || '',
    displaySub: (i) => `Project: ${i.project_code || '-'}`,
  },
  {
    key: 'impl-partners-national', label: 'Partners (National)', labelFr: 'Partenaires nationaux', icon: '\ud83c\udfe0',
    category: 'PAID_IMPL_PARTNER_NATIONAL',
    parentFilterKey: 'project', parentFilterLabel: 'Project',
    fields: [
      { key: 'project_code', label: 'Project', type: 'paid-select', required: true },
      { key: 'country_code', label: 'Country', type: 'single-country', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'National partner name' },
    ],
    displayLabel: (i) => i.name || '',
    displaySub: (i) => `Project: ${i.project_code || '-'} | Country: ${i.country_code || '-'}`,
  },
];

// ─── Country Select (single or multiple based on project type) ────────────────

const ALL_COUNTRIES_SORTED = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));

function CountrySelectField({ value, onChange, multiple }: {
  value: string[];
  onChange: (value: string[]) => void;
  multiple: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return ALL_COUNTRIES_SORTED;
    const q = search.toLowerCase();
    return ALL_COUNTRIES_SORTED.filter((c) =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const toggle = (code: string) => {
    if (multiple) {
      onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
    } else {
      onChange([code]);
      setOpen(false);
    }
  };

  const remove = (code: string) => onChange(value.filter((c) => c !== code));

  return (
    <div>
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((cc) => {
            const c = COUNTRIES[cc];
            return (
              <span key={cc} className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-900/20 dark:text-fuchsia-300">
                {c?.flag} {c?.name ?? cc}
                <button type="button" onClick={() => remove(cc)} className="ml-0.5 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <span className="text-gray-400">
            {value.length > 0
              ? `${value.length} countr${value.length > 1 ? 'ies' : 'y'} selected`
              : multiple ? 'Select countries...' : 'Select a country...'}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <div className="sticky top-0 border-b border-gray-100 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:border-fuchsia-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                autoFocus
              />
            </div>
            {filtered.map((c) => {
              const selected = value.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggle(c.code)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800',
                    selected && 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
                  )}
                >
                  {multiple && <input type="checkbox" checked={selected} readOnly className="h-3.5 w-3.5 rounded border-gray-300 text-fuchsia-600" />}
                  <span>{c.flag}</span>
                  <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                  <span className="ml-auto text-[10px] text-gray-400">{c.code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!multiple && (
        <p className="mt-1 text-[10px] text-gray-400">Single country project — select one country</p>
      )}
      {multiple && (
        <p className="mt-1 text-[10px] text-gray-400">Multiple countries project — select all implementation countries</p>
      )}
    </div>
  );
}

// ─── PAID Entity Select (fetches from PAID API) ──────────────────────────────

const PAID_FIELD_TO_CATEGORY: Record<string, PaidRefCategory> = {
  project_code: 'PAID_PROJECT',
  logframe_code: 'PAID_LOGFRAME',
  activity_code: 'PAID_LF_ACTIVITY',
  subactivity_code: 'PAID_SUBACTIVITY',
  paid_activity_code: 'PAID_PAID_ACTIVITY',
};

function PaidEntitySelect({ fieldKey, value, onChange, required, formValues }: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  formValues: Record<string, unknown>;
}) {
  const category = PAID_FIELD_TO_CATEGORY[fieldKey];

  // Build parent filter based on the hierarchy
  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (fieldKey === 'logframe_code' && formValues.project_code) f.project = formValues.project_code as string;
    if (fieldKey === 'activity_code' && formValues.logframe_code) f.logframe = formValues.logframe_code as string;
    if (fieldKey === 'subactivity_code' && formValues.activity_code) f.activity = formValues.activity_code as string;
    if (fieldKey === 'paid_activity_code' && formValues.subactivity_code) f.subactivity = formValues.subactivity_code as string;
    return f;
  }, [fieldKey, formValues]);

  const { data, isLoading } = usePaidReferentials(category ?? 'PAID_PROJECT', filters);
  const items = data?.data ?? [];

  const options = useMemo(() => items.map((item: PaidReferentialItem) => ({
    value: item.code || String(item.id),
    label: item.title
      ? `${item.code} — ${item.title}`
      : item.label
        ? `${item.code} — ${(item.label as string).slice(0, 80)}`
        : item.name
          ? `${item.code || ''} ${item.name}`
          : item.code || String(item.id),
  })), [items]);

  return (
    <SearchableDropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={isLoading ? 'Loading...' : '-- Select --'}
      required={required}
    />
  );
}

// ─── Inline Form (Create / Edit) ─────────────────────────────────────────────

function InlineForm({ entity, item, onBack }: {
  entity: EntityDef;
  item: PaidReferentialItem | null;
  onBack: () => void;
}) {
  const isEdit = !!item;
  const createMut = useCreatePaidRef(entity.category);
  const updateMut = useUpdatePaidRef(entity.category);

  const [form, setForm] = useState<Record<string, unknown>>(() => {
    if (!item) return {};
    const initial: Record<string, unknown> = {};
    for (const f of entity.fields) {
      const val = (item as any)[f.key];
      initial[f.key] = val ?? '';
    }
    return initial;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form };
    // countries is already an array from country-select
    if (payload.sort_order !== undefined) payload.sort_order = Number(payload.sort_order) || 0;
    if (payload.is_required !== undefined) payload.is_required = payload.is_required === true || payload.is_required === 'true';

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: item!.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      onBack();
    } catch (err: any) {
      alert(err?.message || 'Error saving');
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-5">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit' : 'New'} {entity.label}
          </h2>
          <p className="text-xs text-gray-400">
            {isEdit ? `Editing: ${entity.displayLabel(item!).slice(0, 60)}` : `Create a new ${entity.label.toLowerCase()} record`}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="grid gap-5 p-6 sm:grid-cols-3">
          {entity.fields.map((f) => {
            const span = f.colSpan ?? (f.type === 'textarea' || f.type === 'country-select' ? 3 : 1);
            return (
            <div key={f.key} className={cn(
              span === 2 && 'sm:col-span-2',
              span === 3 && 'sm:col-span-3',
            )}>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {f.label}
                {f.required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  value={(form[f.key] as string) ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">-- Select --</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'country-select' ? (
                <CountrySelectField
                  value={Array.isArray(form[f.key]) ? form[f.key] as string[] : []}
                  onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                  multiple={form.type === 'multiple_countries'}
                />
              ) : f.type === 'paid-select' ? (
                <PaidEntitySelect
                  fieldKey={f.key}
                  value={(form[f.key] as string) ?? ''}
                  onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                  required={f.required}
                  formValues={form}
                />
              ) : f.type === 'single-country' ? (
                <SearchableDropdown
                  value={(form[f.key] as string) ?? ''}
                  onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                  options={ALL_COUNTRIES_SORTED.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
                  placeholder="-- Select country --"
                  required={f.required}
                />
              ) : f.type === 'textarea' ? (
                <textarea
                  value={(form[f.key] as string) ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              ) : f.type === 'boolean' ? (
                <label className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={form[f.key] === true || form[f.key] === 'true'}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Yes</span>
                </label>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={(form[f.key] as string) ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>
          );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-fuchsia-600 px-5 py-2 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Entity List View ─────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50, 100];

function EntityListView({ entity, onEdit, onCreate }: {
  entity: EntityDef;
  onEdit: (item: PaidReferentialItem) => void;
  onCreate: () => void;
}) {
  const [search, setSearch] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const deleteMut = useDeletePaidRef(entity.category);

  // Reset page when filters change
  const prevSearch = useRef(search);
  const prevParent = useRef(parentFilter);
  useEffect(() => {
    if (prevSearch.current !== search || prevParent.current !== parentFilter) {
      setPage(1);
      prevSearch.current = search;
      prevParent.current = parentFilter;
    }
  }, [search, parentFilter]);

  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (search) f.search = search;
    if (parentFilter && entity.parentFilterKey) f[entity.parentFilterKey] = parentFilter;
    f.page = String(page);
    f.limit = String(pageSize);
    return f;
  }, [search, parentFilter, entity.parentFilterKey, page, pageSize]);

  const { data, isLoading } = usePaidReferentials(entity.category, filters);
  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${entity.label.toLowerCase()}...`}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        {entity.parentFilterKey && (
          <input
            type="text"
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
            placeholder={`Filter by ${entity.parentFilterLabel}...`}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white w-48"
          />
        )}
        <span className="text-xs text-gray-400">{total} record{total !== 1 ? 's' : ''}</span>
        <button
          onClick={onCreate}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-2 text-xs font-medium text-white hover:bg-fuchsia-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add {entity.label}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">No {entity.label.toLowerCase()} found</p>
            <button
              onClick={onCreate}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700"
            >
              <Plus className="h-4 w-4" /> Create first {entity.label.toLowerCase()}
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">{entity.label}</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Details</th>
                <th className="w-24 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item: PaidReferentialItem) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{entity.displayLabel(item)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-400 truncate max-w-sm">{entity.displaySub(item)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(item)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${entity.displayLabel(item)}"?`)) deleteMut.mutate(item.id);
                        }}
                        disabled={deleteMut.isPending}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>of {total} records</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'min-w-[32px] rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                    p === page
                      ? 'bg-fuchsia-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
            >
              Last
            </button>
          </div>

          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = { type: 'list' } | { type: 'create' } | { type: 'edit'; item: PaidReferentialItem };

export default function PaidMasterDataPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'projects';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [view, setView] = useState<ViewMode>({ type: 'list' });

  const entity = ENTITIES.find((e) => e.key === activeTab) ?? ENTITIES[0];

  const switchTab = (key: string) => {
    setActiveTab(key);
    setView({ type: 'list' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/master-data"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Master Data
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          PAID Programme — Reference Data
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage LICS projects, log frames (AMERT), activities, PAID activities, breakdown fields and partners.
        </p>
      </div>

      {/* Entity tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => switchTab(e.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === e.key
                ? 'bg-white text-fuchsia-700 shadow-sm dark:bg-gray-900 dark:text-fuchsia-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <span>{e.icon}</span>
            {e.label}
          </button>
        ))}
      </div>

      {/* Content: List or Form */}
      {view.type === 'list' && (
        <EntityListView
          key={entity.key}
          entity={entity}
          onEdit={(item) => setView({ type: 'edit', item })}
          onCreate={() => setView({ type: 'create' })}
        />
      )}

      {view.type === 'create' && (
        <InlineForm
          key={`create-${entity.key}`}
          entity={entity}
          item={null}
          onBack={() => setView({ type: 'list' })}
        />
      )}

      {view.type === 'edit' && (
        <InlineForm
          key={`edit-${view.item.id}`}
          entity={entity}
          item={view.item}
          onBack={() => setView({ type: 'list' })}
        />
      )}
    </div>
  );
}
