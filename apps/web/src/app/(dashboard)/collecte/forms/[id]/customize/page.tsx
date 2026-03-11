'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Lock,
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  useFormBuilderTemplate,
  useFormOverlays,
  useCreateOverlay,
  useUpdateOverlay,
  useDeleteOverlay,
  type FieldOverride,
  type FormOverlayEntity,
} from '@/lib/api/form-builder-hooks';
import {
  FIELD_TYPES,
  FIELD_CATEGORIES,
  MASTER_DATA_TYPES,
  type FieldTypeDefinition,
  type FieldCategory,
} from '@/components/form-builder/utils/field-types';
import {
  createDefaultField,
  generateCodeFromLabel,
  type FormField,
  type FormSection,
  type FormSchema,
  type MultilingualText,
  type SelectOption,
} from '@/components/form-builder/utils/form-schema';

// ── Helpers ──────────────────────────────────────────────────────────────

function ml(t?: MultilingualText): string {
  return t?.en || t?.fr || '';
}

/** Field types that make sense for tenant customization (exclude layout/calculation) */
const CUSTOMIZABLE_CATEGORIES: FieldCategory[] = [
  'text',
  'choice',
  'data-source',
  'date-time',
  'location',
  'media',
  'advanced',
];

const CUSTOMIZABLE_FIELD_TYPES = FIELD_TYPES.filter((ft) =>
  CUSTOMIZABLE_CATEGORIES.includes(ft.category),
);

// ── Main Page ─────────────────────────────────────────────────────────────

export default function FormCustomizePage() {
  const params = useParams();
  const router = useRouter();
  const formId = params?.id as string;

  const user = useAuthStore((s) => s.user);
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const tenantId = user?.tenantId ?? selectedTenant?.id ?? '';
  const tenantLevel = user?.tenantLevel ?? selectedTenant?.level ?? '';
  const tenantName = selectedTenant?.name ?? 'My Tenant';

  // Load base template
  const { data: templateData, isLoading: templateLoading } = useFormBuilderTemplate(formId);

  // Load existing overlays for this template
  const { data: overlaysData, isLoading: overlaysLoading } = useFormOverlays(formId);

  const createOverlay = useCreateOverlay();
  const updateOverlay = useUpdateOverlay();
  const deleteOverlayMut = useDeleteOverlay();

  // Find existing overlay for this tenant
  const existingOverlay = useMemo(() => {
    const overlays = overlaysData?.data ?? [];
    return overlays.find((o) => o.tenantId === tenantId) ?? null;
  }, [overlaysData, tenantId]);

  // Local state
  const [addingField, setAddingField] = useState<{
    type: string;
    sectionId: string;
  } | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FieldCategory>('text');

  // Build the current custom fields from overlay
  const customFields: FieldOverride[] = useMemo(
    () => existingOverlay?.fieldOverrides?.filter((o) => o.action === 'ADD') ?? [],
    [existingOverlay],
  );

  const template = templateData?.data;
  const isLoading = templateLoading || overlaysLoading;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Form not found</p>
      </div>
    );
  }

  if (template.status !== 'PUBLISHED') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Only published forms can be customized.
        </p>
        <button
          onClick={() => router.push('/collecte/forms')}
          className="text-sm text-indigo-600 underline"
        >
          Back to forms
        </button>
      </div>
    );
  }

  const schema: FormSchema =
    template.schema && typeof template.schema === 'object' && 'sections' in (template.schema as object)
      ? (template.schema as FormSchema)
      : { sections: [], settings: {} as FormSchema['settings'] };

  const sections = [...schema.sections].sort((a, b) => a.order - b.order);

  // Toggle section collapse
  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Add field handler ──
  async function handleAddField(field: FormField, sectionId: string) {
    const newOverride: FieldOverride = {
      fieldId: field.id,
      action: 'ADD',
      data: {
        ...field,
        _targetSectionId: sectionId,
        _addedByTenantId: tenantId,
        _addedByTenantName: tenantName,
      },
    };

    const updatedOverrides = [...customFields, newOverride];
    // Also include any non-ADD overrides from the existing overlay
    const otherOverrides = existingOverlay?.fieldOverrides?.filter((o) => o.action !== 'ADD') ?? [];
    const allOverrides = [...otherOverrides, ...updatedOverrides];

    try {
      if (existingOverlay) {
        await updateOverlay.mutateAsync({
          templateId: formId,
          overlayId: existingOverlay.id,
          fieldOverrides: allOverrides,
        });
      } else {
        await createOverlay.mutateAsync({
          templateId: formId,
          tenantId,
          tenantLevel,
          fieldOverrides: allOverrides,
        });
      }
      setAddingField(null);
      showToast('Custom field added successfully');
    } catch (err) {
      showToast('Failed to add field');
    }
  }

  // ── Edit field handler ──
  async function handleEditField(fieldId: string, updatedData: Record<string, unknown>) {
    if (!existingOverlay) return;

    const updatedOverrides = existingOverlay.fieldOverrides.map((o) =>
      o.fieldId === fieldId ? { ...o, data: { ...o.data, ...updatedData } } : o,
    );

    try {
      await updateOverlay.mutateAsync({
        templateId: formId,
        overlayId: existingOverlay.id,
        fieldOverrides: updatedOverrides,
      });
      setEditingFieldId(null);
      showToast('Custom field updated');
    } catch {
      showToast('Failed to update field');
    }
  }

  // ── Delete field handler ──
  async function handleDeleteField(fieldId: string) {
    if (!existingOverlay) return;
    if (!confirm('Remove this custom field?')) return;

    const updatedOverrides = existingOverlay.fieldOverrides.filter(
      (o) => o.fieldId !== fieldId,
    );

    try {
      if (updatedOverrides.length === 0) {
        await deleteOverlayMut.mutateAsync({
          templateId: formId,
          overlayId: existingOverlay.id,
        });
      } else {
        await updateOverlay.mutateAsync({
          templateId: formId,
          overlayId: existingOverlay.id,
          fieldOverrides: updatedOverrides,
        });
      }
      showToast('Custom field removed');
    } catch {
      showToast('Failed to remove field');
    }
  }

  // Group custom fields by their target section
  const customFieldsBySection: Record<string, FieldOverride[]> = {};
  for (const cf of customFields) {
    const sid = (cf.data._targetSectionId as string) ?? '__unassigned';
    if (!customFieldsBySection[sid]) customFieldsBySection[sid] = [];
    customFieldsBySection[sid].push(cf);
  }

  const isMutating =
    createOverlay.isPending || updateOverlay.isPending || deleteOverlayMut.isPending;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          <Check className="h-4 w-4 text-green-400" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/collecte/forms')}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Customize: {template.name}
            </h1>
            <p className="text-xs text-gray-500">
              Add custom fields for{' '}
              <span className="font-medium text-indigo-600">{tenantName}</span>
              {' '}({tenantLevel})
              {existingOverlay && (
                <span className="ml-2 text-green-600">
                  &middot; {customFields.length} custom field{customFields.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        {existingOverlay?.needsReview && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Base template was updated — review your custom fields
          </div>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left panel: Form preview */}
        <div className="flex-1 space-y-4 overflow-y-auto" style={{ flex: '0 0 70%' }}>
          {sections.map((section) => (
            <SectionPreview
              key={section.id}
              section={section}
              customFields={customFieldsBySection[section.id] ?? []}
              tenantName={tenantName}
              isCollapsed={collapsedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              editingFieldId={editingFieldId}
              onEditField={(id) => setEditingFieldId(id)}
              onSaveEdit={handleEditField}
              onCancelEdit={() => setEditingFieldId(null)}
              onDeleteField={handleDeleteField}
              addingField={
                addingField?.sectionId === section.id ? addingField : null
              }
              onAddField={handleAddField}
              onCancelAdd={() => setAddingField(null)}
              isMutating={isMutating}
            />
          ))}

          {/* Custom fields not assigned to existing sections (new custom sections) */}
          {customFieldsBySection['__unassigned'] && (
            <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-800 dark:bg-indigo-900/10">
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                Unassigned Custom Fields
              </h3>
              {customFieldsBySection['__unassigned'].map((cf) => (
                <CustomFieldCard
                  key={cf.fieldId}
                  override={cf}
                  tenantName={tenantName}
                  isEditing={editingFieldId === cf.fieldId}
                  onEdit={() => setEditingFieldId(cf.fieldId)}
                  onSave={handleEditField}
                  onCancel={() => setEditingFieldId(null)}
                  onDelete={() => handleDeleteField(cf.fieldId)}
                  isMutating={isMutating}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: Field palette */}
        <div
          className="shrink-0 space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          style={{ flex: '0 0 28%' }}
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Add Custom Field
          </h2>
          <p className="text-xs text-gray-500">
            Pick a field type and assign it to a section.
          </p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1">
            {FIELD_CATEGORIES.filter((c) =>
              CUSTOMIZABLE_CATEGORIES.includes(c.key),
            ).map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedCategory === cat.key
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Field type list */}
          <div className="space-y-1.5">
            {CUSTOMIZABLE_FIELD_TYPES.filter(
              (ft) => ft.category === selectedCategory,
            ).map((ft) => (
              <FieldTypeButton
                key={ft.type}
                ft={ft}
                sections={sections}
                onSelect={(sectionId) =>
                  setAddingField({ type: ft.type, sectionId })
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section Preview ──────────────────────────────────────────────────────

function SectionPreview({
  section,
  customFields,
  tenantName,
  isCollapsed,
  onToggle,
  editingFieldId,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  onDeleteField,
  addingField,
  onAddField,
  onCancelAdd,
  isMutating,
}: {
  section: FormSection;
  customFields: FieldOverride[];
  tenantName: string;
  isCollapsed: boolean;
  onToggle: () => void;
  editingFieldId: string | null;
  onEditField: (id: string) => void;
  onSaveEdit: (fieldId: string, data: Record<string, unknown>) => void;
  onCancelEdit: () => void;
  onDeleteField: (fieldId: string) => void;
  addingField: { type: string; sectionId: string } | null;
  onAddField: (field: FormField, sectionId: string) => void;
  onCancelAdd: () => void;
  isMutating: boolean;
}) {
  const sectionName = ml(section.name);
  const continentalFields = [...section.fields]
    .filter((f) => !f.hidden)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className="rounded-xl border bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700"
      style={section.color ? { borderTopColor: section.color, borderTopWidth: 3 } : undefined}
    >
      {/* Section Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {sectionName}
        </h2>
        <span className="text-[10px] text-gray-400">
          {continentalFields.length} continental
          {customFields.length > 0 && ` + ${customFields.length} custom`}
        </span>
      </div>

      {!isCollapsed && (
        <div className="space-y-2 px-5 pb-4">
          {/* Continental fields (read-only) */}
          {continentalFields.map((field) => (
            <ContinentalFieldCard key={field.id} field={field} />
          ))}

          {/* Custom fields (editable) */}
          {customFields.map((cf) => (
            <CustomFieldCard
              key={cf.fieldId}
              override={cf}
              tenantName={tenantName}
              isEditing={editingFieldId === cf.fieldId}
              onEdit={() => onEditField(cf.fieldId)}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              onDelete={() => onDeleteField(cf.fieldId)}
              isMutating={isMutating}
            />
          ))}

          {/* Inline add field form */}
          {addingField && (
            <AddFieldInline
              fieldType={addingField.type}
              sectionId={addingField.sectionId}
              onAdd={onAddField}
              onCancel={onCancelAdd}
              isMutating={isMutating}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Continental Field Card (read-only) ───────────────────────────────────

function ContinentalFieldCard({ field }: { field: FormField }) {
  const ftDef = FIELD_TYPES.find((ft) => ft.type === field.type);
  const Icon = ftDef?.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
      <Lock className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />}
      <div className="min-w-0 flex-1">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {ml(field.label)}
        </span>
        {field.required && (
          <span className="ml-1 text-[10px] text-red-400">*</span>
        )}
        <span className="ml-2 text-[10px] text-gray-400">{field.code}</span>
      </div>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        Continental
      </span>
    </div>
  );
}

// ── Custom Field Card (editable) ─────────────────────────────────────────

function CustomFieldCard({
  override,
  tenantName,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isMutating,
}: {
  override: FieldOverride;
  tenantName: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (fieldId: string, data: Record<string, unknown>) => void;
  onCancel: () => void;
  onDelete: () => void;
  isMutating: boolean;
}) {
  const data = override.data;
  const fieldType = (data.type as string) ?? 'text';
  const ftDef = FIELD_TYPES.find((ft) => ft.type === fieldType);
  const Icon = ftDef?.icon;
  const label = ml(data.label as MultilingualText);
  const code = (data.code as string) ?? '';
  const required = (data.required as boolean) ?? false;

  if (isEditing) {
    return (
      <EditFieldInline
        override={override}
        onSave={onSave}
        onCancel={onCancel}
        isMutating={isMutating}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 px-4 py-2.5 dark:border-indigo-700 dark:bg-indigo-900/10">
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label || 'Untitled'}
        </span>
        {required && (
          <span className="ml-1 text-[10px] text-red-400">*</span>
        )}
        <span className="ml-2 text-[10px] text-gray-400">{code}</span>
      </div>
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
        Custom &mdash; {tenantName}
      </span>
      <button
        onClick={onEdit}
        disabled={isMutating}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        title="Edit"
      >
        <Edit3 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        disabled={isMutating}
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
        title="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Add Field Inline Form ────────────────────────────────────────────────

function AddFieldInline({
  fieldType,
  sectionId,
  onAdd,
  onCancel,
  isMutating,
}: {
  fieldType: string;
  sectionId: string;
  onAdd: (field: FormField, sectionId: string) => void;
  onCancel: () => void;
  isMutating: boolean;
}) {
  const ftDef = FIELD_TYPES.find((ft) => ft.type === fieldType);
  const [labelEn, setLabelEn] = useState('');
  const [labelFr, setLabelFr] = useState('');
  const [required, setRequired] = useState(false);
  const [masterDataType, setMasterDataType] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [newOptLabel, setNewOptLabel] = useState('');

  const code = generateCodeFromLabel(labelEn || 'field');

  const needsOptions =
    fieldType === 'select' ||
    fieldType === 'radio' ||
    fieldType === 'multi-select' ||
    fieldType === 'checkbox';

  const needsMasterData = fieldType === 'master-data-select';

  function handleSubmit() {
    if (!labelEn.trim()) return;

    const field = createDefaultField(fieldType, sectionId);
    field.code = `custom_${code}`;
    field.label = { en: labelEn, fr: labelFr || undefined };
    field.required = required;

    if (needsOptions && options.length > 0) {
      field.properties.options = options;
    }
    if (needsMasterData && masterDataType) {
      field.properties.masterDataType = masterDataType;
    }

    onAdd(field, sectionId);
  }

  function addOption() {
    if (!newOptLabel.trim()) return;
    const val = newOptLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setOptions((prev) => [
      ...prev,
      { label: { en: newOptLabel }, value: val },
    ]);
    setNewOptLabel('');
  }

  return (
    <div className="rounded-lg border-2 border-indigo-300 bg-white p-4 shadow-sm dark:border-indigo-600 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ftDef?.icon && <ftDef.icon className="h-4 w-4 text-indigo-500" />}
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            Add {ftDef?.label ?? fieldType} Field
          </span>
        </div>
        <button
          onClick={onCancel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Label EN */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Label (English) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
            placeholder="e.g. Herd Size"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Label FR */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Label (French)
          </label>
          <input
            type="text"
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            placeholder="e.g. Taille du troupeau"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Auto-generated code */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Code
          </label>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700">
            custom_{code}
          </div>
        </div>

        {/* Required toggle */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-gray-700 dark:text-gray-300">Required</span>
        </label>

        {/* Options for select/radio/checkbox */}
        {needsOptions && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Options
            </label>
            {options.map((opt, i) => (
              <div
                key={i}
                className="mb-1 flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-xs dark:bg-gray-700"
              >
                <span className="flex-1 text-gray-700 dark:text-gray-300">
                  {opt.label.en}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newOptLabel}
                onChange={(e) => setNewOptLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                placeholder="Option label..."
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={addOption}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Master data type for master-data-select */}
        {needsMasterData && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Master Data Type
            </label>
            <select
              value={masterDataType}
              onChange={(e) => setMasterDataType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a type...</option>
              {MASTER_DATA_TYPES.map((mdt) => (
                <option key={mdt.value} value={mdt.value}>
                  {mdt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!labelEn.trim() || isMutating}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isMutating ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Add Field
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Field Inline Form ───────────────────────────────────────────────

function EditFieldInline({
  override,
  onSave,
  onCancel,
  isMutating,
}: {
  override: FieldOverride;
  onSave: (fieldId: string, data: Record<string, unknown>) => void;
  onCancel: () => void;
  isMutating: boolean;
}) {
  const data = override.data;
  const existingLabel = data.label as MultilingualText | undefined;
  const [labelEn, setLabelEn] = useState(existingLabel?.en ?? '');
  const [labelFr, setLabelFr] = useState(existingLabel?.fr ?? '');
  const [required, setRequired] = useState((data.required as boolean) ?? false);

  function handleSubmit() {
    if (!labelEn.trim()) return;
    const code = `custom_${generateCodeFromLabel(labelEn)}`;
    onSave(override.fieldId, {
      label: { en: labelEn, fr: labelFr || undefined },
      code,
      required,
    });
  }

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50/30 p-4 dark:border-amber-600 dark:bg-amber-900/10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800 dark:text-white">
          Edit Custom Field
        </span>
        <button
          onClick={onCancel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Label (English) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Label (French)
          </label>
          <input
            type="text"
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-gray-700 dark:text-gray-300">Required</span>
        </label>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!labelEn.trim() || isMutating}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isMutating ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field Type Button (in right panel palette) ───────────────────────────

function FieldTypeButton({
  ft,
  sections,
  onSelect,
}: {
  ft: FieldTypeDefinition;
  sections: FormSection[];
  onSelect: (sectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
      >
        <ft.icon className="h-4 w-4 flex-shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-800 dark:text-gray-200">
            {ft.label}
          </div>
          <div className="text-[10px] text-gray-400">{ft.description}</div>
        </div>
        <Plus className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      </button>

      {/* Section picker dropdown */}
      {open && (
        <div className="ml-7 mt-1 space-y-0.5 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <p className="mb-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
            Add to section:
          </p>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => {
                onSelect(sec.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-gray-700 hover:bg-indigo-100 dark:text-gray-300 dark:hover:bg-indigo-800/30"
            >
              {sec.color && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: sec.color }}
                />
              )}
              {ml(sec.name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
