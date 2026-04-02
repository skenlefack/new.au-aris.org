'use client';

import React, { useState } from 'react';
import {
  useKpiDefinitions,
  useCreateKpiDefinition,
  useUpdateKpiDefinition,
  useDeleteKpiDefinition,
  useSettingsDomains,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { ColorPicker } from '@/components/settings/ColorPicker';
import {
  Loader2,
  Activity,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Star,
} from 'lucide-react';

interface KpiForm {
  code: string;
  name: Record<string, string>;
  description: Record<string, string>;
  domainCode: string;
  icon: string;
  color: string;
  unit: string;
  targetValue: number;
  thresholdGood: number;
  thresholdWarn: number;
  scope: string;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: KpiForm = {
  code: '',
  name: { en: '', fr: '', pt: '', ar: '' },
  description: { en: '', fr: '', pt: '', ar: '' },
  domainCode: '',
  icon: '',
  color: '#1565C0',
  unit: 'percentage',
  targetValue: 100,
  thresholdGood: 75,
  thresholdWarn: 50,
  scope: 'both',
  isActive: true,
  sortOrder: 0,
};

export default function KpisPage() {
  const { isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const t = useTranslations('settings');
  const canManage = isSuperAdmin || isContinentalAdmin;
  const { data, isLoading } = useKpiDefinitions();
  const { data: domainsData } = useSettingsDomains();
  const createMutation = useCreateKpiDefinition();
  const updateMutation = useUpdateKpiDefinition();
  const deleteMutation = useDeleteKpiDefinition();

  const kpis: any[] = data?.data ?? [];
  const domains: any[] = domainsData?.data ?? [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<KpiForm>(EMPTY_FORM);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: kpis.length });
    setShowAddForm(true);
  };

  const openEdit = (kpi: any) => {
    setShowAddForm(false);
    setEditingId(kpi.id);
    setForm({
      code: kpi.code,
      name: kpi.name ?? { en: '', fr: '', pt: '', ar: '' },
      description: kpi.description ?? { en: '', fr: '', pt: '', ar: '' },
      domainCode: kpi.domainCode ?? '',
      icon: kpi.icon ?? '',
      color: kpi.color ?? '#1565C0',
      unit: kpi.unit ?? 'percentage',
      targetValue: kpi.targetValue ?? 100,
      thresholdGood: kpi.thresholdGood ?? 75,
      thresholdWarn: kpi.thresholdWarn ?? 50,
      scope: kpi.scope ?? 'both',
      isActive: kpi.isActive ?? true,
      sortOrder: kpi.sortOrder ?? 0,
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
      domainCode: form.domainCode || null,
      icon: form.icon || null,
      color: form.color || null,
      unit: form.unit,
      targetValue: form.targetValue,
      thresholdGood: form.thresholdGood,
      thresholdWarn: form.thresholdWarn,
      scope: form.scope,
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
      domainCode: form.domainCode || null,
      icon: form.icon || null,
      color: form.color || null,
      unit: form.unit,
      targetValue: form.targetValue,
      thresholdGood: form.thresholdGood,
      thresholdWarn: form.thresholdWarn,
      scope: form.scope,
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

  const deletingKpi = kpis.find((k: any) => k.id === deletingId);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('kpiIndicators')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('kpiIndicatorsDesc', { count: kpis.length })}
            </p>
          </div>
        </div>
        {canManage && !showAddForm && !editingId && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {t('addKpi')}
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <KpiFormPanel
          title={t('newKpiDef')}
          form={form}
          setForm={setForm}
          domains={domains}
          onSave={handleCreate}
          onCancel={cancelForm}
          saving={isSaving}
          isNew
        />
      )}

      {/* KPIs List */}
      <div className="space-y-3">
        {kpis.map((kpi: any) => {
          if (editingId === kpi.id) {
            return (
              <KpiFormPanel
                key={kpi.id}
                title={t('editKpi', { name: kpi.name?.en ?? kpi.code })}
                form={form}
                setForm={setForm}
                domains={domains}
                onSave={handleUpdate}
                onCancel={cancelForm}
                saving={isSaving}
              />
            );
          }

          const domain = domains.find((d: any) => d.code === kpi.domainCode);

          return (
            <div
              key={kpi.id}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${kpi.color ?? '#6B7280'}14`, color: kpi.color ?? '#6B7280' }}
              >
                <span className="text-xs font-bold">{kpi.icon?.slice(0, 2) ?? '%'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {kpi.name?.en ?? kpi.code}
                  </p>
                  {kpi.isPreset && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Star className="h-2.5 w-2.5" />
                      {t('preset')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {domain?.name?.en ?? kpi.domainCode ?? t('generalDomain')} | {t('targetLabel')}: {kpi.targetValue}{kpi.unit === 'percentage' ? '%' : ''} | {t('goodLabel')}: {'\u2265'}{kpi.thresholdGood}% | {t('warnLabel')}: {'\u2265'}{kpi.thresholdWarn}%
                </p>
                {/* Mini progress bar preview */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div className="flex h-full">
                      <div className="h-full bg-red-400" style={{ width: `${kpi.thresholdWarn}%` }} />
                      <div className="h-full bg-amber-400" style={{ width: `${kpi.thresholdGood - kpi.thresholdWarn}%` }} />
                      <div className="h-full bg-emerald-400" style={{ width: `${100 - kpi.thresholdGood}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">{t('alertWarnGood')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {kpi.code}
                </span>
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: kpi.isActive ? '#ecfdf5' : '#f3f4f6',
                    color: kpi.isActive ? '#059669' : '#9ca3af',
                  }}
                >
                  {kpi.isActive ? t('active') : t('inactive')}
                </span>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(kpi)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!kpi.isPreset && (
                      <button
                        type="button"
                        onClick={() => setDeletingId(kpi.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {kpis.length === 0 && !showAddForm && (
        <div className="py-12 text-center text-sm text-gray-400">
          {t('noKpisYet')}
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && deletingKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('deleteKpi')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('deleteKpiConfirm', { name: deletingKpi.name?.en ?? deletingKpi.code })}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
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

function KpiFormPanel({
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
  form: KpiForm;
  setForm: React.Dispatch<React.SetStateAction<KpiForm>>;
  domains: any[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const t = useTranslations('settings');
  const canSave = form.code.trim().length >= 1 && (form.name.en?.trim() ?? '').length > 0;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 dark:border-emerald-800 dark:bg-emerald-900/10">
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
              placeholder={t('kpiCodePlaceholder')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('domain')}</label>
          <select
            value={form.domainCode}
            onChange={(e) => setForm((f) => ({ ...f, domainCode: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">{t('generalAllDomains')}</option>
            {domains.map((d: any) => (
              <option key={d.code} value={d.code}>{d.name?.en ?? d.code}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('icon')} (Lucide)</label>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder={t('kpiIconPlaceholder')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <ColorPicker
          label={t('color')}
          value={form.color}
          onChange={(c) => setForm((f) => ({ ...f, color: c }))}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('targetValue')}</label>
          <input
            type="number"
            min={0}
            value={form.targetValue}
            onChange={(e) => setForm((f) => ({ ...f, targetValue: parseFloat(e.target.value) || 100 }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('goodThreshold')}
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.thresholdGood}
            onChange={(e) => setForm((f) => ({ ...f, thresholdGood: parseInt(e.target.value, 10) || 75 }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('warnThreshold')}
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.thresholdWarn}
            onChange={(e) => setForm((f) => ({ ...f, thresholdWarn: parseInt(e.target.value, 10) || 50 }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('scope')}</label>
          <select
            value={form.scope}
            onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="both">{t('scopeBoth')}</option>
            <option value="country">{t('scopeCountry')}</option>
            <option value="rec">{t('scopeRec')}</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.isActive ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">{form.isActive ? t('active') : t('inactive')}</span>
        </div>
      </div>

      <div className="mt-4">
        <MultilingualInput
          label={t('name')}
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          required
          placeholder={t('kpiNamePlaceholder')}
        />
      </div>

      {/* Threshold Preview */}
      <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {t('thresholdPreview')}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div className="flex h-full">
            <div className="h-full bg-red-400" style={{ width: `${form.thresholdWarn}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${form.thresholdGood - form.thresholdWarn}%` }} />
            <div className="h-full bg-emerald-400" style={{ width: `${100 - form.thresholdGood}%` }} />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-gray-400">
          <span>0% ({t('thresholdAlert')})</span>
          <span>{form.thresholdWarn}% ({t('thresholdWarning')})</span>
          <span>{form.thresholdGood}% ({t('thresholdGood')})</span>
          <span>100%</span>
        </div>
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
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isNew ? t('create') : t('save')}
        </button>
      </div>
    </div>
  );
}
