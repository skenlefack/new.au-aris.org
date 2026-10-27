'use client';

import React, { useState } from 'react';
import { Shield, Plus, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMdmPolicies,
  useCreateMdmPolicy,
  useUpdateMdmPolicy,
  useDeleteMdmPolicy,
  type MdmPolicy,
} from '@/lib/api/mdm-hooks';
import { useTranslations } from '@/lib/i18n/translations';

interface PolicyFormState {
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  minAppVersion: string;
  requireScreenLock: boolean;
  maxOfflineDays: string;
  minBatteryForSync: string;
  gpsRequired: boolean;
  maxStorageUsagePercent: string;
}

const EMPTY_FORM: PolicyFormState = {
  name: '',
  description: '',
  priority: 0,
  isActive: true,
  minAppVersion: '',
  requireScreenLock: false,
  maxOfflineDays: '',
  minBatteryForSync: '',
  gpsRequired: false,
  maxStorageUsagePercent: '',
};

function formFromPolicy(p: MdmPolicy): PolicyFormState {
  return {
    name: p.name,
    description: p.description ?? '',
    priority: p.priority,
    isActive: p.isActive,
    minAppVersion: p.rules.minAppVersion != null ? String(p.rules.minAppVersion) : '',
    requireScreenLock: p.rules.requireScreenLock ?? false,
    maxOfflineDays: p.rules.maxOfflineDays != null ? String(p.rules.maxOfflineDays) : '',
    minBatteryForSync: p.rules.minBatteryForSync != null ? String(p.rules.minBatteryForSync) : '',
    gpsRequired: p.rules.gpsRequired ?? false,
    maxStorageUsagePercent: p.rules.maxStorageUsagePercent != null ? String(p.rules.maxStorageUsagePercent) : '',
  };
}

function formToRules(f: PolicyFormState): MdmPolicy['rules'] {
  const rules: MdmPolicy['rules'] = {};
  if (f.minAppVersion) rules.minAppVersion = parseInt(f.minAppVersion) || undefined;
  if (f.requireScreenLock) rules.requireScreenLock = true;
  if (f.maxOfflineDays) rules.maxOfflineDays = parseInt(f.maxOfflineDays) || undefined;
  if (f.minBatteryForSync) rules.minBatteryForSync = parseInt(f.minBatteryForSync) || undefined;
  if (f.gpsRequired) rules.gpsRequired = true;
  if (f.maxStorageUsagePercent) rules.maxStorageUsagePercent = parseInt(f.maxStorageUsagePercent) || undefined;
  return rules;
}

function countActiveRules(rules: MdmPolicy['rules']): number {
  let count = 0;
  if (rules.minAppVersion != null) count++;
  if (rules.requireScreenLock) count++;
  if (rules.maxOfflineDays != null) count++;
  if (rules.minBatteryForSync != null) count++;
  if (rules.gpsRequired) count++;
  if (rules.maxStorageUsagePercent != null) count++;
  return count;
}

export function PoliciesTab() {
  const t = useTranslations('mdm');
  const { data, isLoading } = useMdmPolicies();
  const createPolicy = useCreateMdmPolicy();
  const updatePolicy = useUpdateMdmPolicy();
  const deletePolicy = useDeleteMdmPolicy();

  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<MdmPolicy | null>(null);
  const [form, setForm] = useState<PolicyFormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const policies: MdmPolicy[] = data?.data ?? [];

  const openCreate = () => {
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (policy: MdmPolicy) => {
    setEditingPolicy(policy);
    setForm(formFromPolicy(policy));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = () => {
    const rules = formToRules(form);
    if (editingPolicy) {
      updatePolicy.mutate(
        { id: editingPolicy.id, name: form.name, description: form.description || undefined, rules, isActive: form.isActive, priority: form.priority },
        { onSuccess: closeForm },
      );
    } else {
      createPolicy.mutate(
        { name: form.name, description: form.description || undefined, rules, isActive: form.isActive, priority: form.priority },
        { onSuccess: closeForm },
      );
    }
  };

  const handleDelete = () => {
    if (deleteId) deletePolicy.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const isSaving = createPolicy.isPending || updatePolicy.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{t('policiesDescription')}</p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('newPolicy')}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {editingPolicy ? t('editPolicy') : t('newPolicy')}
            </h4>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-medium text-gray-500 uppercase">{t('policyName')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Default Security Policy"
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">{t('policyPriority')}</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">{t('policyDescription')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional description..."
            />
          </div>

          {/* Rules */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase mb-2 block">{t('policyRules')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500">{t('ruleMinAppVersion')}</label>
                <input
                  type="number"
                  value={form.minAppVersion}
                  onChange={(e) => setForm((f) => ({ ...f, minAppVersion: e.target.value }))}
                  placeholder="e.g. 5"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">{t('ruleMaxOfflineDays')}</label>
                <input
                  type="number"
                  value={form.maxOfflineDays}
                  onChange={(e) => setForm((f) => ({ ...f, maxOfflineDays: e.target.value }))}
                  placeholder="e.g. 7"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">{t('ruleMinBattery')}</label>
                <input
                  type="number"
                  value={form.minBatteryForSync}
                  onChange={(e) => setForm((f) => ({ ...f, minBatteryForSync: e.target.value }))}
                  placeholder="e.g. 15"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">{t('ruleMaxStorage')}</label>
                <input
                  type="number"
                  value={form.maxStorageUsagePercent}
                  onChange={(e) => setForm((f) => ({ ...f, maxStorageUsagePercent: e.target.value }))}
                  placeholder="e.g. 90"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  checked={form.requireScreenLock}
                  onChange={(e) => setForm((f) => ({ ...f, requireScreenLock: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label className="text-xs text-gray-600 dark:text-gray-400">{t('ruleScreenLock')}</label>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  checked={form.gpsRequired}
                  onChange={(e) => setForm((f) => ({ ...f, gpsRequired: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label className="text-xs text-gray-600 dark:text-gray-400">{t('ruleGps')}</label>
              </div>
            </div>
          </div>

          {/* Active toggle + Submit */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-gray-300"
              />
              {t('policyActive')}
            </label>
            <button
              onClick={handleSubmit}
              disabled={!form.name || isSaving}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {isSaving ? t('saving') : editingPolicy ? t('updatePolicy') : t('createPolicy')}
            </button>
          </div>
        </div>
      )}

      {/* Policies Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2.5 text-left">{t('policyName')}</th>
              <th className="px-3 py-2.5 text-center">{t('policyRules')}</th>
              <th className="px-3 py-2.5 text-center">{t('policyPriority')}</th>
              <th className="px-3 py-2.5 text-center">{t('status')}</th>
              <th className="px-3 py-2.5 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td>
              </tr>
            )}
            {!isLoading && policies.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>{t('noPolicies')}</p>
                </td>
              </tr>
            )}
            {policies.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                  {p.description && <p className="text-[10px] text-gray-400 truncate max-w-[240px]">{p.description}</p>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    {countActiveRules(p.rules)} rules
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-500">{p.priority}</td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => updatePolicy.mutate({ id: p.id, isActive: !p.isActive })}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      p.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span className={cn(
                      'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform',
                      p.isActive ? 'translate-x-4' : 'translate-x-0.5',
                    )} />
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600"
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
      </div>

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('deletePolicy')}</h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('deletePolicyConfirm')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
