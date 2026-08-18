'use client';

import React, { useState, useMemo } from 'react';
import {
  useStatisticDefinitions,
  useCreateStatisticDefinition,
  useUpdateStatisticDefinition,
  useDeleteStatisticDefinition,
  useSettingsDomains,
} from '@/lib/api/settings-hooks';
import { useFormBuilderTemplates, useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import type { FormSchema, FormField, FormSection } from '@/components/form-builder/utils/form-schema';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { ColorPicker } from '@/components/settings/ColorPicker';
import {
  Loader2,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface StatForm {
  code: string;
  name: Record<string, string>;
  description: Record<string, string>;
  domainCode: string;
  icon: string;
  color: string;
  unit: string;
  format: string;
  sourceType: string;
  sourceConfig: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: StatForm = {
  code: '',
  name: { en: '', fr: '', pt: '', ar: '', es: '', sw: '' },
  description: { en: '', fr: '', pt: '', ar: '', es: '', sw: '' },
  domainCode: '',
  icon: '',
  color: '#1565C0',
  unit: 'count',
  format: 'number',
  sourceType: 'manual',
  sourceConfig: null,
  isActive: true,
  sortOrder: 0,
};

const UNITS = ['count', 'percentage', 'currency', 'tonnes', 'heads', 'doses'];
const FORMATS = ['number', 'currency', 'compact'];
const SOURCE_TYPES = ['manual', 'form_builder'];

const LAYOUT_FIELD_TYPES = ['heading', 'divider', 'info-box', 'spacer'];
const NUMERIC_FIELD_TYPES = ['number', 'calculated', 'rating'];
const AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'] as const;
const FILTER_OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_not_empty'] as const;

type Aggregation = typeof AGGREGATIONS[number];
type FilterOperator = typeof FILTER_OPERATORS[number];

interface SourceConfigField {
  fieldCode: string;
  fieldLabel: string;
  fieldType: string;
  aggregation: Aggregation;
  filter?: {
    operator: FilterOperator;
    value?: string | number;
  };
}

interface SourceConfig {
  templateId: string;
  templateName: string;
  fields: SourceConfigField[];
}

export default function StatisticsPage() {
  const t = useTranslations('settings');
  const { isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const canManage = isSuperAdmin || isContinentalAdmin;
  const { data, isLoading } = useStatisticDefinitions();
  const { data: domainsData } = useSettingsDomains();
  const createMutation = useCreateStatisticDefinition();
  const updateMutation = useUpdateStatisticDefinition();
  const deleteMutation = useDeleteStatisticDefinition();

  const statDefs: any[] = data?.data ?? [];
  const domains: any[] = domainsData?.data ?? [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<StatForm>(EMPTY_FORM);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: statDefs.length });
    setShowAddForm(true);
  };

  const openEdit = (stat: any) => {
    setShowAddForm(false);
    setEditingId(stat.id);
    setForm({
      code: stat.code,
      name: stat.name ?? { en: '', fr: '', pt: '', ar: '', es: '', sw: '' },
      description: stat.description ?? { en: '', fr: '', pt: '', ar: '', es: '', sw: '' },
      domainCode: stat.domainCode ?? '',
      icon: stat.icon ?? '',
      color: stat.color ?? '#1565C0',
      unit: stat.unit ?? 'count',
      format: stat.format ?? 'number',
      sourceType: stat.sourceType ?? 'manual',
      sourceConfig: stat.sourceConfig ?? null,
      isActive: stat.isActive ?? true,
      sortOrder: stat.sortOrder ?? 0,
    });
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleCreate = async () => {
    await createMutation.mutateAsync({
      code: form.code,
      name: form.name,
      description: form.description,
      domainCode: form.domainCode,
      icon: form.icon || null,
      color: form.color || null,
      unit: form.unit,
      format: form.format,
      sourceType: form.sourceType,
      sourceConfig: form.sourceConfig,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    });
    cancelForm();
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await updateMutation.mutateAsync({
      id: editingId,
      name: form.name,
      description: form.description,
      domainCode: form.domainCode,
      icon: form.icon || null,
      color: form.color || null,
      unit: form.unit,
      format: form.format,
      sourceType: form.sourceType,
      sourceConfig: form.sourceConfig,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    });
    cancelForm();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteMutation.mutateAsync(deletingId);
    setDeletingId(null);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Group by domain
  const grouped = statDefs.reduce((acc: Record<string, any[]>, stat: any) => {
    const key = stat.domainCode ?? 'uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(stat);
    return acc;
  }, {} as Record<string, any[]>);

  const deletingStat = statDefs.find((s: any) => s.id === deletingId);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('statisticDefinitions')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('statisticDefinitionsDesc', { count: String(statDefs.length) })}
            </p>
          </div>
        </div>
        {canManage && !showAddForm && !editingId && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('addStatistic')}
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <StatFormPanel
          title={t('newStatisticDef')}
          form={form}
          setForm={setForm}
          domains={domains}
          onSave={handleCreate}
          onCancel={cancelForm}
          saving={isSaving}
          isNew
        />
      )}

      {/* Grouped List */}
      {Object.entries(grouped).map(([domainCode, stats]) => {
        const domain = domains.find((d: any) => d.code === domainCode);
        return (
          <div key={domainCode}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: domain?.color ?? '#6B7280' }}
              />
              {domain?.name?.en ?? domainCode}
            </h3>
            <div className="space-y-2">
              {stats.map((stat: any) => {
                if (editingId === stat.id) {
                  return (
                    <StatFormPanel
                      key={stat.id}
                      title={t('editStatistic', { name: stat.name?.en ?? stat.code })}
                      form={form}
                      setForm={setForm}
                      domains={domains}
                      onSave={handleUpdate}
                      onCancel={cancelForm}
                      saving={isSaving}
                    />
                  );
                }
                return (
                  <div
                    key={stat.id}
                    className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${stat.color ?? '#6B7280'}14`, color: stat.color ?? '#6B7280' }}
                    >
                      <span className="text-xs font-bold">{stat.icon?.slice(0, 2) ?? '#'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {stat.name?.en ?? stat.code}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {stat.unit} | {stat.sourceType}{stat.sourceType === 'form_builder' && stat.sourceConfig?.templateName ? ` (${stat.sourceConfig.templateName})` : ''} | {stat.format}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        {stat.code}
                      </span>
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: stat.isActive ? '#ecfdf5' : '#f3f4f6',
                          color: stat.isActive ? '#059669' : '#9ca3af',
                        }}
                      >
                        {stat.isActive ? t('active') : t('inactive')}
                      </span>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(stat)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(stat.id)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {statDefs.length === 0 && !showAddForm && (
        <div className="py-12 text-center text-sm text-gray-400">
          {t('noStatisticsYet')}
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && deletingStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('deleteStatistic')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('deleteStatisticConfirm', { name: deletingStat.name?.en ?? deletingStat.code })}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatFormPanel({
  title,
  form,
  setForm,
  domains,
  onSave,
  onCancel,
  saving,
  isNew = false,
}: {
  title: string;
  form: StatForm;
  setForm: React.Dispatch<React.SetStateAction<StatForm>>;
  domains: any[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const t = useTranslations('settings');
  const canSave = form.code.trim().length >= 1 && (form.name.en?.trim() ?? '').length > 0 && form.domainCode.length > 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5 dark:border-blue-800 dark:bg-blue-900/10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <button type="button" onClick={onCancel} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {isNew && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('code')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder={t('codePlaceholder')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('domain')} <span className="text-red-500">*</span>
          </label>
          <select
            value={form.domainCode}
            onChange={(e) => setForm((f) => ({ ...f, domainCode: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">{t('selectDomain')}</option>
            {domains.map((d: any) => (
              <option key={d.code} value={d.code}>{d.name?.en ?? d.code}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('iconLucide')}</label>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder={t('iconPlaceholder')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <ColorPicker
          label={t('color')}
          value={form.color}
          onChange={(c) => setForm((f) => ({ ...f, color: c }))}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('unit')}</label>
          <select
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('format')}</label>
          <select
            value={form.format}
            onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sourceType')}</label>
          <select
            value={form.sourceType}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({
                ...f,
                sourceType: v,
                sourceConfig: v === 'form_builder' ? f.sourceConfig : null,
              }));
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sortOrder')}</label>
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">{form.isActive ? t('active') : t('inactive')}</span>
        </div>
      </div>

      {form.sourceType === 'form_builder' && (
        <div className="mt-4">
          <FormBuilderSourceConfig form={form} setForm={setForm} />
        </div>
      )}

      <div className="mt-4">
        <MultilingualInput
          label={t('name')}
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          required
          placeholder={t('statNamePlaceholder')}
        />
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canSave}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isNew ? t('create') : t('save')}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Form Builder Source Config
// ════════════════════════════════════════════════════════════════

function FormBuilderSourceConfig({
  form,
  setForm,
}: {
  form: StatForm;
  setForm: React.Dispatch<React.SetStateAction<StatForm>>;
}) {
  const t = useTranslations('settings');
  const sourceConfig = form.sourceConfig as SourceConfig | null;
  const selectedTemplateId = sourceConfig?.templateId ?? '';

  const { data: templatesData, isLoading: loadingTemplates } = useFormBuilderTemplates({ status: 'PUBLISHED', limit: 200 });
  const templates = templatesData?.data ?? [];

  const { data: templateDetail, isLoading: loadingDetail } = useFormBuilderTemplate(selectedTemplateId || undefined);
  const schema = (templateDetail?.data?.schema as FormSchema | undefined) ?? null;

  const dataFields = useMemo(() => {
    if (!schema?.sections) return [];
    const result: Array<{ section: FormSection; field: FormField }> = [];
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (!LAYOUT_FIELD_TYPES.includes(field.type)) {
          result.push({ section, field });
        }
      }
    }
    return result;
  }, [schema]);

  const sectionGroups = useMemo(() => {
    const map = new Map<string, { section: FormSection; fields: FormField[] }>();
    for (const { section, field } of dataFields) {
      if (!map.has(section.id)) {
        map.set(section.id, { section, fields: [] });
      }
      map.get(section.id)!.fields.push(field);
    }
    return Array.from(map.values());
  }, [dataFields]);

  const handleTemplateChange = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!templateId) {
      setForm((f) => ({ ...f, sourceConfig: null }));
      return;
    }
    setForm((f) => ({
      ...f,
      sourceConfig: {
        templateId,
        templateName: tpl?.name ?? '',
        fields: [],
      } satisfies SourceConfig,
    }));
  };

  const updateFields = (fields: SourceConfigField[]) => {
    setForm((f) => ({
      ...f,
      sourceConfig: {
        ...(f.sourceConfig as unknown as SourceConfig),
        fields,
      },
    }));
  };

  const toggleField = (field: FormField, checked: boolean) => {
    const current = (sourceConfig?.fields ?? []) as SourceConfigField[];
    if (checked) {
      const defaultAgg: Aggregation = NUMERIC_FIELD_TYPES.includes(field.type) ? 'sum' : 'count';
      updateFields([
        ...current,
        { fieldCode: field.code, fieldLabel: field.label?.en ?? field.code, fieldType: field.type, aggregation: defaultAgg },
      ]);
    } else {
      updateFields(current.filter((f) => f.fieldCode !== field.code));
    }
  };

  const updateFieldConfig = (fieldCode: string, updates: Partial<SourceConfigField>) => {
    const current = (sourceConfig?.fields ?? []) as SourceConfigField[];
    updateFields(current.map((f) => f.fieldCode === fieldCode ? { ...f, ...updates } : f));
  };

  const selectedCodes = new Set((sourceConfig?.fields ?? []).map((f: SourceConfigField) => f.fieldCode));

  const selectCls = 'rounded border border-gray-200 px-2 py-1 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white';
  const inputCls = 'w-20 rounded border border-gray-200 px-2 py-1 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

  return (
    <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-800 dark:bg-indigo-900/10">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('formBuilderConfig')}</h4>

      {/* Template selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('formTemplate')}</label>
        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('loadingTemplates')}
          </div>
        ) : (
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">{t('selectForm')}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.domain}) — v{t.version}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Fields configuration */}
      {selectedTemplateId && (
        loadingDetail ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('loadingFormFields')}
          </div>
        ) : sectionGroups.length === 0 ? (
          <p className="text-xs text-gray-400">{t('noDataFields')}</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('fieldsConfig')}</label>
            {sectionGroups.map(({ section, fields }) => (
              <div key={section.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {section.name?.en ?? t('sectionFallback')}
                </p>
                <div className="space-y-2">
                  {fields.map((field) => {
                    const isSelected = selectedCodes.has(field.code);
                    const config = isSelected
                      ? (sourceConfig?.fields as SourceConfigField[]).find((f) => f.fieldCode === field.code)
                      : null;
                    const isNumeric = NUMERIC_FIELD_TYPES.includes(field.type);

                    return (
                      <div key={field.id} className="flex flex-wrap items-center gap-2">
                        {/* Checkbox */}
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleField(field, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {field.label?.en ?? field.code}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">{field.code}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            {field.type}
                          </span>
                        </label>

                        {/* Aggregation + Filter (only when selected) */}
                        {isSelected && config && (
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                            <select
                              value={config.aggregation}
                              onChange={(e) => updateFieldConfig(field.code, { aggregation: e.target.value as Aggregation })}
                              className={selectCls}
                            >
                              {AGGREGATIONS.map((a) => (
                                <option
                                  key={a}
                                  value={a}
                                  disabled={!isNumeric && !['count', 'count_distinct'].includes(a)}
                                >
                                  {a}
                                </option>
                              ))}
                            </select>

                            {/* Filter */}
                            <select
                              value={config.filter?.operator ?? ''}
                              onChange={(e) => {
                                const op = e.target.value as FilterOperator | '';
                                if (!op) {
                                  updateFieldConfig(field.code, { filter: undefined });
                                } else {
                                  updateFieldConfig(field.code, {
                                    filter: { operator: op, value: op === 'is_not_empty' ? undefined : config.filter?.value ?? '' },
                                  });
                                }
                              }}
                              className={selectCls}
                            >
                              <option value="">{t('noFilter')}</option>
                              {FILTER_OPERATORS.map((op) => (
                                <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
                              ))}
                            </select>

                            {config.filter && config.filter.operator !== 'is_not_empty' && (
                              <input
                                type="text"
                                value={config.filter.value ?? ''}
                                onChange={(e) =>
                                  updateFieldConfig(field.code, {
                                    filter: { ...config.filter!, value: e.target.value },
                                  })
                                }
                                placeholder="value"
                                className={inputCls}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {selectedCodes.size > 0 && (
              <p className="text-[10px] text-gray-400">
                {t('fieldsSelected', { count: String(selectedCodes.size) })}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
