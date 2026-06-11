'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, Search, X, Save, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  type: 'text' | 'textarea' | 'select' | 'multi-text' | 'number' | 'boolean';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  readOnly?: boolean;
  /** For parent lookups */
  parentCategory?: PaidRefCategory;
  parentFilterKey?: string;
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
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. ANGR' },
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Project full title' },
      { key: 'type', label: 'Type', type: 'select', required: true, options: [
        { value: 'single_country', label: 'Single Country' },
        { value: 'multiple_countries', label: 'Multiple Countries' },
      ]},
      { key: 'countries', label: 'Countries (comma-separated codes)', type: 'text', placeholder: 'KE,ET,NG,TZ' },
    ],
    displayLabel: (i) => `${i.code} \u2014 ${i.title || ''}`,
    displaySub: (i) => `Type: ${i.type || '-'} | Countries: ${Array.isArray(i.countries) ? (i.countries as string[]).join(', ') : '-'}`,
  },
  {
    key: 'logframes', label: 'Log Frames (AMERT)', labelFr: 'Cadres logiques', icon: '\ud83c\udfaf',
    category: 'PAID_LOGFRAME',
    parentFilterKey: 'project', parentFilterLabel: 'Project code',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1' },
      { key: 'project_code', label: 'Project Code', type: 'text', required: true, placeholder: 'e.g. ANGR' },
      { key: 'label', label: 'Label', type: 'textarea', required: true, placeholder: 'Log frame description' },
    ],
    displayLabel: (i) => `${i.code} \u2014 ${(i.label || '').slice(0, 80)}`,
    displaySub: (i) => `Project: ${i.project_code || '-'}`,
  },
  {
    key: 'lf-activities', label: 'Activities', labelFr: 'Activites', icon: '\u26a1',
    category: 'PAID_LF_ACTIVITY',
    parentFilterKey: 'logframe', parentFilterLabel: 'Log Frame code',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01' },
      { key: 'logframe_code', label: 'Log Frame Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1' },
      { key: 'label', label: 'Label', type: 'textarea', required: true, placeholder: 'Activity description' },
    ],
    displayLabel: (i) => `${i.code} \u2014 ${(i.label || '').slice(0, 80)}`,
    displaySub: (i) => `Log Frame: ${i.logframe_code || '-'}`,
  },
  {
    key: 'subactivities', label: 'Sub-Activities', labelFr: 'Sous-activites', icon: '\ud83d\udccc',
    category: 'PAID_SUBACTIVITY',
    parentFilterKey: 'activity', parentFilterLabel: 'Activity code',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01.01' },
      { key: 'activity_code', label: 'Activity Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01' },
      { key: 'label', label: 'Label', type: 'textarea', required: true, placeholder: 'Sub-activity description' },
      { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', placeholder: 'e.g. Number of MOUs' },
    ],
    displayLabel: (i) => `${i.code} \u2014 ${(i.label || '').slice(0, 80)}`,
    displaySub: (i) => `Activity: ${i.activity_code || '-'} | Unit: ${i.unit_of_measure || '-'}`,
  },
  {
    key: 'paid-activities', label: 'PAID Activities', labelFr: 'Activites PAID', icon: '\ud83d\udcca',
    category: 'PAID_PAID_ACTIVITY',
    parentFilterKey: 'subactivity', parentFilterLabel: 'Sub-Activity code',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01.01_PA' },
      { key: 'subactivity_code', label: 'Sub-Activity Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01.01' },
      { key: 'label', label: 'Label', type: 'text', required: true, placeholder: 'e.g. Training/sensitization' },
      { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', placeholder: 'e.g. persons, report' },
    ],
    displayLabel: (i) => `${i.code} \u2014 ${i.label || ''}`,
    displaySub: (i) => `Sub-Activity: ${i.subactivity_code || '-'} | Unit: ${i.unit_of_measure || '-'}`,
  },
  {
    key: 'breakdown-fields', label: 'Breakdown Fields', labelFr: 'Champs de ventilation', icon: '\ud83d\udd27',
    category: 'PAID_BREAKDOWN_FIELD',
    parentFilterKey: 'paid_activity', parentFilterLabel: 'PAID Activity code',
    fields: [
      { key: 'paid_activity_code', label: 'PAID Activity Code', type: 'text', required: true, placeholder: 'e.g. 2.2.1.01.03_PA' },
      { key: 'field_code', label: 'Field Code', type: 'text', required: true, placeholder: 'e.g. n_female_trained' },
      { key: 'field_label', label: 'Field Label', type: 'text', required: true, placeholder: 'e.g. Number of females trained' },
      { key: 'field_type', label: 'Field Type', type: 'select', required: true, options: [
        { value: 'number', label: 'Number' },
        { value: 'text', label: 'Text' },
        { value: 'textarea', label: 'Textarea' },
        { value: 'select', label: 'Select' },
        { value: 'select_multiple', label: 'Select Multiple' },
        { value: 'date', label: 'Date' },
      ]},
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '0' },
      { key: 'is_required', label: 'Required', type: 'boolean' },
    ],
    displayLabel: (i) => `${i.field_code || ''} \u2014 ${i.field_label || ''}`,
    displaySub: (i) => `PAID Activity: ${i.paid_activity_code || '-'} | Type: ${i.field_type || '-'} | Order: ${i.sort_order ?? 0}`,
  },
  {
    key: 'executive-partners', label: 'Executive Partners', labelFr: 'Partenaires executifs', icon: '\ud83c\udfdb',
    category: 'PAID_EXEC_PARTNER',
    parentFilterKey: 'project', parentFilterLabel: 'Project code',
    fields: [
      { key: 'project_code', label: 'Project Code', type: 'text', required: true, placeholder: 'e.g. ANGR' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. AU-IBAR' },
    ],
    displayLabel: (i) => i.name || '',
    displaySub: (i) => `Project: ${i.project_code || '-'}`,
  },
  {
    key: 'impl-partners-intl', label: 'Partners (International)', labelFr: 'Partenaires internationaux', icon: '\ud83c\udf0d',
    category: 'PAID_IMPL_PARTNER_INTL',
    parentFilterKey: 'project', parentFilterLabel: 'Project code',
    fields: [
      { key: 'project_code', label: 'Project Code', type: 'text', required: true, placeholder: 'e.g. ANGR' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Partner organization name' },
    ],
    displayLabel: (i) => i.name || '',
    displaySub: (i) => `Project: ${i.project_code || '-'}`,
  },
  {
    key: 'impl-partners-national', label: 'Partners (National)', labelFr: 'Partenaires nationaux', icon: '\ud83c\udfe0',
    category: 'PAID_IMPL_PARTNER_NATIONAL',
    parentFilterKey: 'project', parentFilterLabel: 'Project code',
    fields: [
      { key: 'project_code', label: 'Project Code', type: 'text', required: true, placeholder: 'e.g. ANGR' },
      { key: 'country_code', label: 'Country Code', type: 'text', placeholder: 'e.g. KE' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'National partner name' },
    ],
    displayLabel: (i) => i.name || '',
    displaySub: (i) => `Project: ${i.project_code || '-'} | Country: ${i.country_code || '-'}`,
  },
];

// ─── Generic CRUD Form Modal ─────────────────────────────────────────────────

function CrudModal({ entity, item, onClose }: {
  entity: EntityDef;
  item: PaidReferentialItem | null; // null = create mode
  onClose: () => void;
}) {
  const isEdit = !!item;
  const createMut = useCreatePaidRef(entity.category);
  const updateMut = useUpdatePaidRef(entity.category);
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    if (!item) return {};
    const initial: Record<string, unknown> = {};
    for (const f of entity.fields) {
      const val = (item as any)[f.key];
      if (f.key === 'countries' && Array.isArray(val)) {
        initial[f.key] = (val as string[]).join(',');
      } else {
        initial[f.key] = val ?? '';
      }
    }
    return initial;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form };
    // Convert comma-separated countries to array
    if (typeof payload.countries === 'string') {
      payload.countries = (payload.countries as string).split(',').map((s) => s.trim()).filter(Boolean);
    }
    // Convert numeric fields
    if (payload.sort_order !== undefined) payload.sort_order = Number(payload.sort_order) || 0;
    if (payload.is_required !== undefined) payload.is_required = payload.is_required === true || payload.is_required === 'true';

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: item!.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Error saving');
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit' : 'Create'} {entity.label}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {entity.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {f.label}
                {f.required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  value={(form[f.key] as string) ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">-- Select --</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={(form[f.key] as string) ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              ) : f.type === 'boolean' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[f.key] === true || form[f.key] === 'true'}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
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
                  readOnly={f.readOnly}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Entity List Page ─────────────────────────────────────────────────────────

function EntityPage({ entity }: { entity: EntityDef }) {
  const [search, setSearch] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [modalItem, setModalItem] = useState<PaidReferentialItem | null | undefined>(undefined); // undefined = closed
  const deleteMut = useDeletePaidRef(entity.category);

  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (search) f.search = search;
    if (parentFilter && entity.parentFilterKey) f[entity.parentFilterKey] = parentFilter;
    return f;
  }, [search, parentFilter, entity.parentFilterKey]);

  const { data, isLoading } = usePaidReferentials(entity.category, filters);
  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const handleDelete = useCallback((item: PaidReferentialItem) => {
    const label = entity.displayLabel(item);
    if (confirm(`Delete "${label}"?`)) {
      deleteMut.mutate(item.id);
    }
  }, [entity, deleteMut]);

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
          onClick={() => setModalItem(null)}
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
              onClick={() => setModalItem(null)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700"
            >
              <Plus className="h-4 w-4" /> Create first {entity.label.toLowerCase()}
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {entity.label}
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Details
                </th>
                <th className="w-24 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item: PaidReferentialItem) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                      {entity.displayLabel(item)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-400 truncate max-w-sm">
                      {entity.displaySub(item)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModalItem(item)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
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

      {/* CRUD Modal */}
      {modalItem !== undefined && (
        <CrudModal
          entity={entity}
          item={modalItem}
          onClose={() => setModalItem(undefined)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaidMasterDataPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'projects';
  const [activeTab, setActiveTab] = useState(initialTab);

  const entity = ENTITIES.find((e) => e.key === activeTab) ?? ENTITIES[0];

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
          PAID Programme \u2014 Reference Data
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
            onClick={() => setActiveTab(e.key)}
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

      {/* Active entity page */}
      <EntityPage key={entity.key} entity={entity} />
    </div>
  );
}
