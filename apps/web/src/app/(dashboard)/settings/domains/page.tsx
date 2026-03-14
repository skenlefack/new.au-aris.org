'use client';

import React, { useState } from 'react';
import {
  useSettingsDomains,
  useCreateDomain,
  useUpdateDomain,
  useDeleteDomain,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';
import { ColorPicker } from '@/components/settings/ColorPicker';
import {
  Loader2,
  Layers,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import type { DomainSectionConfig } from '@/lib/hooks/use-domain-config';

const DEFAULT_SECTIONS: DomainSectionConfig = {
  kpis: true,
  chart: true,
  quickLinks: true,
  campaigns: true,
  alertForm: true,
  table: true,
};

interface DomainForm {
  code: string;
  name: Record<string, string>;
  description: Record<string, string>;
  icon: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  modules: { sections: DomainSectionConfig };
}

const EMPTY_FORM: DomainForm = {
  code: '',
  name: { en: '', fr: '', pt: '', ar: '', es: '' },
  description: { en: '', fr: '', pt: '', ar: '', es: '' },
  icon: 'Layers',
  color: '#003399',
  isActive: true,
  sortOrder: 0,
  modules: { sections: { ...DEFAULT_SECTIONS } },
};

export default function DomainsPage() {
  const t = useTranslations('settings');
  const { isSuperAdmin } = useSettingsAccess();
  const { data, isLoading } = useSettingsDomains();
  const createMutation = useCreateDomain();
  const updateMutation = useUpdateDomain();
  const deleteMutation = useDeleteDomain();

  const domains: any[] = data?.data ?? [];

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<DomainForm>(EMPTY_FORM);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: domains.length });
    setShowAddForm(true);
  };

  const openEdit = (domain: any) => {
    setShowAddForm(false);
    setEditingId(domain.id);
    setForm({
      code: domain.code,
      name: domain.name ?? { en: '', fr: '', pt: '', ar: '', es: '' },
      description: domain.description ?? { en: '', fr: '', pt: '', ar: '', es: '' },
      icon: domain.icon ?? 'Layers',
      color: domain.color ?? '#003399',
      isActive: domain.isActive ?? true,
      sortOrder: domain.sortOrder ?? 0,
      modules: {
        sections: { ...DEFAULT_SECTIONS, ...domain.metadata?.modules?.sections },
      },
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
      icon: form.icon,
      color: form.color,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      metadata: { modules: form.modules },
    });
    cancelForm();
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const domain = domains.find((d: any) => d.id === editingId);
    await updateMutation.mutateAsync({
      id: editingId,
      name: form.name,
      description: form.description,
      icon: form.icon,
      color: form.color,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      metadata: { ...domain?.metadata, modules: form.modules },
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

  const deletingDomain = domains.find((d: any) => d.id === deletingId);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('domainsTitle')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('domainsSubtitle', { count: domains.length })}
            </p>
          </div>
        </div>
        {isSuperAdmin && !showAddForm && !editingId && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            {t('addDomain')}
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <DomainFormPanel
          title={t('newDomain')}
          form={form}
          setForm={setForm}
          onSave={handleCreate}
          onCancel={cancelForm}
          saving={isSaving}
          isNew
        />
      )}

      {/* Domains List */}
      <div className="space-y-3">
        {domains.map((domain: any, idx: number) => {
          const isEditing = editingId === domain.id;

          if (isEditing) {
            return (
              <DomainFormPanel
                key={domain.id}
                title={t('editDomainLabel', { name: domain.name?.en ?? domain.code })}
                form={form}
                setForm={setForm}
                onSave={handleUpdate}
                onCancel={cancelForm}
                saving={isSaving}
              />
            );
          }

          return (
            <div
              key={domain.id}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: domain.color }}
              >
                {idx + 1}
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${domain.color}14`, color: domain.color }}
              >
                <span className="text-sm font-bold">{domain.icon?.slice(0, 2) ?? '?'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {domain.name?.en ?? domain.code}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {domain.description?.en}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {domain.code}
                </span>
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: domain.isActive ? '#ecfdf5' : '#f3f4f6',
                    color: domain.isActive ? '#059669' : '#9ca3af',
                  }}
                >
                  {domain.isActive ? t('active') : t('inactive')}
                </span>
                {isSuperAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(domain)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(domain.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Delete"
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

      {domains.length === 0 && !showAddForm && (
        <div className="py-12 text-center text-sm text-gray-400">
          {t('noDomains')}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && deletingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('deleteDomain')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('deleteDomainConfirm', { name: deletingDomain.name?.en ?? deletingDomain.code })}
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
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable Form Panel (create / edit) ── */

function DomainFormPanel({
  title,
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  isNew = false,
}: {
  title: string;
  form: DomainForm;
  setForm: React.Dispatch<React.SetStateAction<DomainForm>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const t = useTranslations('settings');
  const canSave = form.code.trim().length >= 2 && (form.name.en?.trim() ?? '').length > 0;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 dark:border-indigo-800 dark:bg-indigo-900/10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Code (only for new domains) */}
        {isNew && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="e.g. animal-health"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        {/* Icon name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('iconLucide')}
          </label>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="e.g. HeartPulse, Wheat, Fish"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        {/* Color */}
        <ColorPicker
          label={t('color')}
          value={form.color}
          onChange={(c) => setForm((f) => ({ ...f, color: c }))}
        />

        {/* Sort Order */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('sortOrder')}
          </label>
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              form.isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {form.isActive ? t('active') : t('inactive')}
          </span>
        </div>
      </div>

      {/* Name (multilingual) */}
      <div className="mt-4">
        <MultilingualInput
          label={t('name')}
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          required
          placeholder="Domain name..."
        />
      </div>

      {/* Description (multilingual) */}
      <div className="mt-4">
        <MultilingualTextarea
          label={t('description')}
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Domain description..."
          rows={2}
        />
      </div>

      {/* Module Configuration */}
      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-indigo-500" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('landingPageSections')}
          </h4>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          {t('toggleSectionsDesc')}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ['kpis', t('kpiCards')],
              ['chart', t('chart')],
              ['quickLinks', t('quickLinks')],
              ['campaigns', t('campaigns')],
              ['alertForm', t('alertForm')],
              ['table', t('dataTable')],
            ] as [keyof DomainSectionConfig, string][]
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
            >
              <button
                type="button"
                role="switch"
                aria-checked={form.modules.sections[key]}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    modules: {
                      ...f.modules,
                      sections: {
                        ...f.modules.sections,
                        [key]: !f.modules.sections[key],
                      },
                    },
                  }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  form.modules.sections[key]
                    ? 'bg-indigo-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.modules.sections[key]
                      ? 'translate-x-4'
                      : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Preview
        </p>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: form.color }}
          >
            {form.icon?.slice(0, 2) ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {form.name.en || t('domainName')}
            </p>
            <p className="text-xs text-gray-500">
              {form.code || t('domainCode')}
            </p>
          </div>
          <span
            className="ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: form.isActive ? '#ecfdf5' : '#f3f4f6',
              color: form.isActive ? '#059669' : '#9ca3af',
            }}
          >
            {form.isActive ? t('active') : t('inactive')}
          </span>
        </div>
      </div>

      {/* Actions */}
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
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {isNew ? t('create') : t('save')}
        </button>
      </div>
    </div>
  );
}
