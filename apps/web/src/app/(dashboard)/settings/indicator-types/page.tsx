'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useIndicatorTypes,
  useCreateIndicatorType,
  useUpdateIndicatorType,
  useDeleteIndicatorType,
} from '@/lib/api/indicator-hooks';
import type { IndicatorType } from '@/lib/api/indicator-hooks';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { useAutoTranslateOnBlur } from '@/components/settings/AutoTranslateGroup';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

export default function IndicatorTypesPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <IndicatorTypesList />;
}

/* ------------------------------------------------------------------ */
/*  Modal Form                                                         */
/* ------------------------------------------------------------------ */

interface TypeFormData {
  code: string;
  labelFr: string;
  labelEn: string;
  labelAr: string;
  labelPt: string;
  labelEs: string;
  labelSw: string;
  description: string;
  color: string;
  iconName: string;
  displayOrder: number;
}

const EMPTY_FORM: TypeFormData = {
  code: '',
  labelFr: '',
  labelEn: '',
  labelAr: '',
  labelPt: '',
  labelEs: '',
  labelSw: '',
  description: '',
  color: '#1F4E79',
  iconName: '',
  displayOrder: 0,
};

function TypeFormModal({
  initial,
  isEdit,
  onClose,
  onSave,
  isPending,
}: {
  initial: TypeFormData;
  isEdit: boolean;
  onClose: () => void;
  onSave: (data: TypeFormData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<TypeFormData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { handleBlur } = useAutoTranslateOnBlur(
    { en: form.labelEn, fr: form.labelFr, pt: form.labelPt, ar: form.labelAr, es: form.labelEs, sw: form.labelSw },
    {
      en: (v) => setForm((f) => ({ ...f, labelEn: v })),
      fr: (v) => setForm((f) => ({ ...f, labelFr: v })),
      pt: (v) => setForm((f) => ({ ...f, labelPt: v })),
      ar: (v) => setForm((f) => ({ ...f, labelAr: v })),
      es: (v) => setForm((f) => ({ ...f, labelEs: v })),
      sw: (v) => setForm((f) => ({ ...f, labelSw: v })),
    },
  );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = 'Code is required.';
    else if (!/^[A-Z][A-Z0-9_]*$/.test(form.code)) e.code = 'Format: UPPERCASE_SNAKE (e.g. PERFORMANCE).';
    if (!form.labelFr.trim()) e.labelFr = 'Label FR is required.';
    if (!form.labelEn.trim()) e.labelEn = 'Label EN is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (validate()) onSave(form);
  };

  const inputCls = (field: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
      errors[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="mx-4 w-full max-w-lg space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Indicator Type' : 'New Indicator Type'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Code */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
            disabled={isEdit}
            placeholder="PERFORMANCE, COVERAGE..."
            className={`${inputCls('code')} font-mono ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
          />
          {errors.code && <p className="text-xs text-red-600">{errors.code}</p>}
        </div>

        {/* Labels FR / EN */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label FR <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.labelFr} onChange={(e) => setForm({ ...form, labelFr: e.target.value })} onBlur={handleBlur}
              placeholder="Performance" className={inputCls('labelFr')} />
            {errors.labelFr && <p className="text-xs text-red-600">{errors.labelFr}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label EN <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} onBlur={handleBlur}
              placeholder="Performance" className={inputCls('labelEn')} />
            {errors.labelEn && <p className="text-xs text-red-600">{errors.labelEn}</p>}
          </div>
        </div>

        {/* Labels AR / PT */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label AR <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input type="text" value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} onBlur={handleBlur}
              dir="rtl" className={inputCls('labelAr')} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label PT <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input type="text" value={form.labelPt} onChange={(e) => setForm({ ...form, labelPt: e.target.value })} onBlur={handleBlur}
              className={inputCls('labelPt')} />
          </div>
        </div>

        {/* Color + Icon + Order */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color || '#1F4E79'}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700" />
              <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 font-mono text-xs shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Icon name</label>
            <input type="text" value={form.iconName} onChange={(e) => setForm({ ...form, iconName: e.target.value })}
              placeholder="bar-chart-3"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display order</label>
            <input type="number" min={0} value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value, 10) || 0 })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Description of this indicator type..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F4E79]/90 disabled:opacity-50">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main List                                                          */
/* ------------------------------------------------------------------ */

function IndicatorTypesList() {
  const addToast = useRealtimeStore((s) => s.addToast);
  const { data, isLoading } = useIndicatorTypes();
  const createMutation = useCreateIndicatorType();
  const updateMutation = useUpdateIndicatorType();
  const deleteMutation = useDeleteIndicatorType();

  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<IndicatorType | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const types = data?.data ?? [];
  const sortedTypes = [...types].sort((a, b) => a.displayOrder - b.displayOrder);

  const handleCreate = async (formData: TypeFormData) => {
    try {
      await createMutation.mutateAsync({
        code: formData.code,
        labelFr: formData.labelFr,
        labelEn: formData.labelEn,
        labelAr: formData.labelAr || undefined,
        labelPt: formData.labelPt || undefined,
        description: formData.description || undefined,
        color: formData.color || undefined,
        iconName: formData.iconName || undefined,
        displayOrder: formData.displayOrder,
      });
      addToast({ type: 'success', title: 'Type created', message: `${formData.code} created successfully.` });
      setShowForm(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to create type.' });
    }
  };

  const handleUpdate = async (formData: TypeFormData) => {
    try {
      await updateMutation.mutateAsync({
        code: formData.code,
        labelFr: formData.labelFr,
        labelEn: formData.labelEn,
        labelAr: formData.labelAr || undefined,
        labelPt: formData.labelPt || undefined,
        description: formData.description || undefined,
        color: formData.color || undefined,
        iconName: formData.iconName || undefined,
        displayOrder: formData.displayOrder,
      });
      addToast({ type: 'success', title: 'Type updated', message: `${formData.code} updated successfully.` });
      setEditingType(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to update type.' });
    }
  };

  const handleToggleActive = async (t: IndicatorType) => {
    try {
      await updateMutation.mutateAsync({ code: t.code, active: !t.active });
      addToast({
        type: 'success',
        title: t.active ? 'Type deactivated' : 'Type activated',
        message: `${t.code} ${t.active ? 'deactivated' : 'activated'} successfully.`,
      });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to toggle status.' });
    }
  };

  const handleDelete = async () => {
    if (!deletingCode) return;
    try {
      await deleteMutation.mutateAsync(deletingCode);
      addToast({ type: 'success', title: 'Deleted', message: `${deletingCode} deleted successfully.` });
      setDeletingCode(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.message || 'Failed to delete type.' });
      setDeletingCode(null);
    }
  };

  const deletingType = sortedTypes.find((t) => t.code === deletingCode);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F4E79] to-[#1F4E79]/80 text-white shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Indicator Types</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sortedTypes.length} type{sortedTypes.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1F4E79]/90"
        >
          <Plus className="h-4 w-4" />
          New type
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Code</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Label FR</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Label EN</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Color</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Active</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Order</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedTypes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No indicator types found. Click &quot;New type&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  sortedTypes.map((t) => (
                    <tr key={t.code} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {t.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.labelFr}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.labelEn}</td>
                      <td className="px-4 py-3">
                        {t.color ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full border border-gray-200 dark:border-gray-600"
                              style={{ backgroundColor: t.color }} />
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{t.color}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(t)}
                          disabled={updateMutation.isPending}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            t.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          title={t.active ? 'Deactivate' : 'Activate'}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${t.active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t.displayOrder}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button"
                            onClick={() => setEditingType(t)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button"
                            onClick={() => setDeletingCode(t.code)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <TypeFormModal
          initial={EMPTY_FORM}
          isEdit={false}
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
          isPending={createMutation.isPending}
        />
      )}

      {/* Edit modal */}
      {editingType && (
        <TypeFormModal
          initial={{
            code: editingType.code,
            labelFr: editingType.labelFr,
            labelEn: editingType.labelEn,
            labelAr: editingType.labelAr ?? '',
            labelPt: editingType.labelPt ?? '',
            description: editingType.description ?? '',
            color: editingType.color ?? '#1F4E79',
            iconName: editingType.iconName ?? '',
            displayOrder: editingType.displayOrder,
          }}
          isEdit
          onClose={() => setEditingType(null)}
          onSave={handleUpdate}
          isPending={updateMutation.isPending}
        />
      )}

      {/* Delete confirmation modal */}
      {deletingCode && deletingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete indicator type</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete <strong>{deletingType.code}</strong> ({deletingType.labelEn})?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingCode(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
