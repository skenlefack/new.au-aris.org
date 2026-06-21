'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Lock,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useFormBuilderTemplate,
  useFormExtensions,
  useFormExtension,
  useCreateExtension,
  useAddExtensionField,
  useUpdateExtensionField,
  useDeleteExtensionField,
  useSubmitExtension,
  usePublishExtension,
  type FormExtensionEntity,
  type FormExtensionFieldEntity,
} from '@/lib/api/form-builder-hooks';
import {
  FIELD_TYPES,
  type FieldCategory,
} from '@/components/form-builder/utils/field-types';
import {
  generateCodeFromLabel,
  type FormSchema,
  type MultilingualText,
} from '@/components/form-builder/utils/form-schema';

// ── Helpers ──

function ml(v?: MultilingualText | Record<string, string>): string {
  if (!v) return '';
  return (v as any).en || (v as any).fr || '';
}

const STATUS_I18N_KEY: Record<string, string> = {
  DRAFT: 'extensionStatusDraft',
  PENDING_VALIDATION: 'extensionStatusPending',
  PUBLISHED: 'extensionStatusPublished',
  ARCHIVED: 'extensionStatusArchived',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_VALIDATION: 'bg-amber-100 text-amber-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

const STATUS_ICON: Record<string, typeof Clock> = {
  DRAFT: FileText,
  PENDING_VALIDATION: Clock,
  PUBLISHED: CheckCircle2,
  ARCHIVED: FileText,
};

/** Field types suitable for extension (exclude layout-only types) */
const EXTENSION_CATEGORIES: FieldCategory[] = [
  'text',
  'choice',
  'data-source',
  'date-time',
  'location',
  'media',
  'advanced',
];

const EXTENSION_FIELD_TYPES = FIELD_TYPES.filter((ft) =>
  EXTENSION_CATEGORIES.includes(ft.category),
);

const LANG_KEYS = [
  { code: 'en', i18nKey: 'english' },
  { code: 'fr', i18nKey: 'french' },
  { code: 'pt', i18nKey: 'portuguese' },
  { code: 'ar', i18nKey: 'arabic' },
] as const;

// ── Main Page ──

export default function FormExtendPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = params?.id as string;
  const campaignId = searchParams?.get('campaignId') ?? '';
  const t = useTranslations('collecte');

  const user = useAuthStore((s) => s.user);
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const tenantId = user?.tenantId ?? selectedTenant?.id ?? '';
  const tenantLevel = user?.tenantLevel ?? selectedTenant?.level ?? '';
  const tenantName = selectedTenant?.name ?? '';

  // Map tenant level to extension level
  const extensionLevel = tenantLevel === 'MEMBER_STATE' ? 'COUNTRY' : tenantLevel === 'REC' ? 'REC' : null;

  // Load base template
  const { data: templateData, isLoading: templateLoading } = useFormBuilderTemplate(formId);

  // Load existing extensions for this form+campaign+tenant
  const { data: extensionsData, isLoading: extensionsLoading } = useFormExtensions(
    formId,
    { campaignId, tenantId },
  );

  // Mutations
  const createExtension = useCreateExtension();
  const addFieldMut = useAddExtensionField();
  const updateFieldMut = useUpdateExtensionField();
  const deleteFieldMut = useDeleteExtensionField();
  const submitExtension = useSubmitExtension();
  const publishExtension = usePublishExtension();

  // Find the active extension (DRAFT or PENDING_VALIDATION first, then PUBLISHED)
  const extension = useMemo<FormExtensionEntity | null>(() => {
    const exts = extensionsData?.data ?? [];
    return (
      exts.find((e) => e.status === 'DRAFT') ??
      exts.find((e) => e.status === 'PENDING_VALIDATION') ??
      exts.find((e) => e.status === 'PUBLISHED') ??
      null
    );
  }, [extensionsData]);

  // Load the full extension detail if we have one
  const { data: extensionDetail, isLoading: extDetailLoading } = useFormExtension(
    extension?.id,
  );
  const activeExtension = extensionDetail?.data ?? extension;

  // Local state
  const [addingField, setAddingField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const template = templateData?.data;
  const isLoading = templateLoading || extensionsLoading || extDetailLoading;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Validation ──

  if (!campaignId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('extendFormCampaignRequired')}
        </p>
        <button
          onClick={() => router.push('/collecte/forms')}
          className="text-sm text-indigo-600 underline"
        >
          {t('backToForms')}
        </button>
      </div>
    );
  }

  if (!extensionLevel) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('extendFormOnlyRec')}
        </p>
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-600 underline"
        >
          {t('back')}
        </button>
      </div>
    );
  }

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
        <p className="text-sm text-gray-500">{t('formNotFound')}</p>
      </div>
    );
  }

  if (template.status !== 'PUBLISHED') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('extendFormOnlyPublished')}
        </p>
        <button
          onClick={() => router.push('/collecte/forms')}
          className="text-sm text-indigo-600 underline"
        >
          {t('backToForms')}
        </button>
      </div>
    );
  }

  const schema: FormSchema =
    template.schema && typeof template.schema === 'object' && 'sections' in (template.schema as object)
      ? (template.schema as FormSchema)
      : { sections: [], settings: {} as FormSchema['settings'] };

  const sections = [...schema.sections].sort((a, b) => a.order - b.order);

  const isDraft = activeExtension?.status === 'DRAFT';
  const isPending = activeExtension?.status === 'PENDING_VALIDATION';

  // ── Handlers ──
  async function handleCreateExtension() {
    try {
      await createExtension.mutateAsync({
        baseFormId: formId,
        campaignId,
        level: extensionLevel!,
        tenantId,
      });
      showToast(t('extensionCreated'));
    } catch (err: any) {
      showToast(err?.message ?? t('extensionConflict'));
    }
  }

  async function handleSubmit() {
    if (!activeExtension) return;
    try {
      await submitExtension.mutateAsync(activeExtension.id);
      showToast(t('extensionSubmitted'));
    } catch (err: any) {
      showToast(err?.message ?? t('extensionSubmitted'));
    }
  }

  async function handlePublish() {
    if (!activeExtension) return;
    try {
      await publishExtension.mutateAsync(activeExtension.id);
      showToast(t('extensionPublished'));
    } catch (err: any) {
      showToast(err?.message ?? t('extensionPublished'));
    }
  }

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const StatusIcon = activeExtension ? (STATUS_ICON[activeExtension.status] ?? FileText) : FileText;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('extendForm')}
            </h1>
            <p className="text-sm text-gray-500">
              {template.name} — {tenantName} ({extensionLevel})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeExtension && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLOR[activeExtension.status] ?? '')}>
              <StatusIcon className="h-3 w-3" />
              {t(STATUS_I18N_KEY[activeExtension.status] ?? 'extensionStatusDraft')}
            </span>
          )}
          {isDraft && activeExtension && activeExtension.fields.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={submitExtension.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {t('submitForValidation')}
            </button>
          )}
          {isPending && (
            <button
              onClick={handlePublish}
              disabled={publishExtension.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('publishExtension')}
            </button>
          )}
        </div>
      </div>

      {/* No extension yet */}
      {!activeExtension && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('noExtensionYet')}
          </p>
          <p className="mb-4 text-xs text-gray-500">
            {t('noExtensionYetDesc')}
          </p>
          <button
            onClick={handleCreateExtension}
            disabled={createExtension.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t('createExtension')}
          </button>
        </div>
      )}

      {/* Extension exists */}
      {activeExtension && (
        <div className="space-y-6">
          {/* Base Form Fields (locked) */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-400" />
              {t('baseFormFields')}
            </h2>
            <div className="space-y-3">
              {sections.map((sec) => (
                <div key={sec.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    {collapsedSections.has(sec.id) ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <Lock className="h-3 w-3 text-gray-400" />
                    {ml(sec.name)} ({sec.fields?.length ?? 0})
                  </button>
                  {!collapsedSections.has(sec.id) && (
                    <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
                      {(sec.fields ?? [])
                        .sort((a, b) => a.order - b.order)
                        .map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center gap-3 py-1.5 text-sm text-gray-500"
                          >
                            <Lock className="h-3 w-3 shrink-0 text-gray-300" />
                            <span className="font-mono text-xs text-gray-400">{field.code || field.id}</span>
                            <span>{ml(field.label)}</span>
                            <span className="ml-auto text-xs text-gray-400">{field.type}</span>
                            {field.required && (
                              <span className="text-xs text-red-400">*</span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Extension Fields */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-500" />
              {t('extensionFieldsCount', { count: activeExtension.fields.length })}
              <span className="ml-auto text-xs font-normal text-gray-400">
                v{activeExtension.version}
              </span>
            </h2>

            {activeExtension.fields.length === 0 && !addingField && (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                <p className="text-sm text-gray-500 mb-3">
                  {t('noExtensionFields')}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {activeExtension.fields.map((field) => (
                <ExtensionFieldRow
                  key={field.id}
                  field={field}
                  isDraft={isDraft}
                  editingFieldId={editingFieldId}
                  t={t}
                  onEdit={() => setEditingFieldId(field.id)}
                  onCancelEdit={() => setEditingFieldId(null)}
                  onUpdate={async (updates) => {
                    try {
                      await updateFieldMut.mutateAsync({
                        extensionId: activeExtension.id,
                        fieldId: field.id,
                        ...updates,
                      });
                      setEditingFieldId(null);
                      showToast(t('extensionFieldUpdated'));
                    } catch (err: any) {
                      showToast(err?.message ?? t('extensionFieldUpdated'));
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteFieldMut.mutateAsync({
                        extensionId: activeExtension.id,
                        fieldId: field.id,
                      });
                      showToast(t('extensionFieldDeleted'));
                    } catch (err: any) {
                      showToast(err?.message ?? t('extensionFieldDeleted'));
                    }
                  }}
                />
              ))}
            </div>

            {/* Add field button */}
            {isDraft && !addingField && (
              <button
                onClick={() => setAddingField(true)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-300 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
              >
                <Plus className="h-4 w-4" />
                {t('addExtensionField')}
              </button>
            )}

            {/* Add field form */}
            {isDraft && addingField && (
              <AddFieldForm
                extensionId={activeExtension.id}
                t={t}
                onAdd={async (data) => {
                  try {
                    await addFieldMut.mutateAsync({
                      extensionId: activeExtension.id,
                      ...data,
                    });
                    setAddingField(false);
                    showToast(t('extensionFieldAdded'));
                  } catch (err: any) {
                    showToast(err?.message ?? t('extensionFieldAdded'));
                  }
                }}
                onCancel={() => setAddingField(false)}
                isPending={addFieldMut.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Extension Field Row ──

function ExtensionFieldRow({
  field,
  isDraft,
  editingFieldId,
  t,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  field: FormExtensionFieldEntity;
  isDraft: boolean;
  editingFieldId: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<Pick<FormExtensionFieldEntity, 'fieldKey' | 'labelI18n' | 'type' | 'required'>>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const isEditing = editingFieldId === field.id;
  const [editLabel, setEditLabel] = useState(field.labelI18n);
  const [editRequired, setEditRequired] = useState(field.required);
  const [editType, setEditType] = useState(field.type);
  const [deleting, setDeleting] = useState(false);

  if (isEditing && isDraft) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {LANG_KEYS.map((lang) => (
            <div key={lang.code}>
              <label className="text-xs text-gray-500">{t(lang.i18nKey)}</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                value={(editLabel as any)[lang.code] ?? ''}
                onChange={(e) =>
                  setEditLabel((prev) => ({ ...prev, [lang.code]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-2">
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
          >
            {EXTENSION_FIELD_TYPES.map((ft) => (
              <option key={ft.type} value={ft.type}>
                {ft.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editRequired}
              onChange={(e) => setEditRequired(e.target.checked)}
            />
            {t('fieldRequired')}
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
          >
            <X className="h-3 w-3" /> {t('cancel')}
          </button>
          <button
            onClick={() =>
              onUpdate({
                labelI18n: editLabel,
                type: editType,
                required: editRequired,
              })
            }
            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
          >
            <Check className="h-3 w-3" /> {t('save')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
      <span className="font-mono text-xs text-indigo-500">{field.fieldKey}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300">{ml(field.labelI18n)}</span>
      <span className="ml-auto text-xs text-gray-400">{field.type}</span>
      {field.required && <span className="text-xs text-red-400">*</span>}
      {isDraft && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Edit3 className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button
            onClick={async () => {
              setDeleting(true);
              await onDelete();
              setDeleting(false);
            }}
            disabled={deleting}
            className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add Field Form ──

function AddFieldForm({
  extensionId,
  t,
  onAdd,
  onCancel,
  isPending,
}: {
  extensionId: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onAdd: (data: {
    fieldKey: string;
    labelI18n: Record<string, string>;
    type: string;
    required: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [labelI18n, setLabelI18n] = useState<Record<string, string>>({
    en: '',
    fr: '',
    pt: '',
    ar: '',
  });
  const [fieldType, setFieldType] = useState('text');
  const [required, setRequired] = useState(false);
  const [fieldKey, setFieldKey] = useState('');

  // Auto-generate field key from English label
  const autoKey = useMemo(() => {
    return generateCodeFromLabel(labelI18n.en || '');
  }, [labelI18n.en]);

  const effectiveKey = fieldKey || autoKey;

  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('newExtensionField')}
      </h3>

      {/* Labels */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {LANG_KEYS.map((lang) => (
          <div key={lang.code}>
            <label className="text-xs text-gray-500">{t(lang.i18nKey)}</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder={t(lang.i18nKey)}
              value={labelI18n[lang.code] ?? ''}
              onChange={(e) =>
                setLabelI18n((prev) => ({ ...prev, [lang.code]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      {/* Field key */}
      <div className="mb-3">
        <label className="text-xs text-gray-500">
          {t('extensionFieldKey')}
        </label>
        <input
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono dark:border-gray-600 dark:bg-gray-800"
          placeholder={autoKey || 'ext_custom_field'}
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_'))}
        />
        {!fieldKey && autoKey && (
          <p className="mt-0.5 text-xs text-gray-400">
            {t('extensionFieldKeyAuto', { key: autoKey })}
          </p>
        )}
      </div>

      {/* Type + Required */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">{t('fieldType')}</label>
          <select
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
          >
            {EXTENSION_FIELD_TYPES.map((ft) => (
              <option key={ft.type} value={ft.type}>
                {ft.label}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-4 flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          {t('fieldRequired')}
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {t('cancel')}
        </button>
        <button
          onClick={() =>
            onAdd({
              fieldKey: effectiveKey,
              labelI18n,
              type: fieldType,
              required,
            })
          }
          disabled={!effectiveKey || !labelI18n.en || isPending}
          className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('addExtensionField')}
        </button>
      </div>
    </div>
  );
}
