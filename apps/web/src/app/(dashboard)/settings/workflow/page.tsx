'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  ArrowDown,
  Layers,
  Search,
} from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore, deriveCountryCodeFromEmail } from '@/lib/stores/tenant-store';
import {
  useWorkflowDefinitions,
  useWorkflowDefinition,
  useWorkflowByCountry,
  useCreateWorkflowDef,
  useUpdateWorkflowDef,
  useCreateWorkflowStep,
  useUpdateWorkflowStep,
  useDeleteWorkflowStep,
} from '@/lib/api/workflow-hooks';

/* ── Helpers ── */

function i18n(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj['en'] ?? obj['fr'] ?? Object.values(obj)[0] ?? '';
  }
  return String(val);
}

const LEVEL_TYPES = ['admin5', 'admin4', 'admin3', 'admin2', 'admin1', 'national', 'regional', 'continental'];

/* ── Loading skeleton ── */
function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}

/* ── Main Page ── */

export default function WorkflowConfigPage() {
  const { user } = useAuthStore();
  const isNational = user?.role === 'NATIONAL_ADMIN';
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const countryCode = selectedTenant?.level === 'MEMBER_STATE'
    ? selectedTenant.code
    : deriveCountryCodeFromEmail(user?.email) ?? undefined;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  // Fetch all records (max 100 per backend schema) — client-side search + pagination
  const { data: allWfRes, isLoading: allLoading } = useWorkflowDefinitions({ limit: 100 });
  const { data: countryWfRes, isLoading: countryLoading } = useWorkflowByCountry(
    isNational ? countryCode : undefined,
  );

  const allWorkflows = isNational
    ? (countryWfRes?.data ? [countryWfRes.data] : [])
    : (allWfRes?.data ?? []);
  const filtered = search
    ? allWorkflows.filter((wf: any) => {
        const q = search.toLowerCase();
        return i18n(wf.name).toLowerCase().includes(q)
          || i18n(wf.country?.name).toLowerCase().includes(q);
      })
    : allWorkflows;
  const totalFiltered = filtered.length;
  const workflows = filtered.slice((page - 1) * limit, page * limit);
  const isLoading = isNational ? countryLoading : allLoading;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Configuration</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure validation workflows per country: steps, delays, and auto-transmit rules
          </p>
        </div>
        {!isNational && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Workflow
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateWorkflowForm onClose={() => setShowCreateForm(false)} />
      )}

      {/* Search bar */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search workflows..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
        />
      </div>

      {isLoading ? (
        <Skeleton />
      ) : workflows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
          <Settings className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            No workflow definitions found
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a workflow to define validation steps for a country.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf: any) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              isExpanded={selectedId === wf.id}
              onToggle={() => setSelectedId(selectedId === wf.id ? null : wf.id)}
            />
          ))}
          {!isNational && (
            <Pagination
              page={page}
              total={totalFiltered}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Workflow Card ── */

function WorkflowCard({
  workflow,
  isExpanded,
  onToggle,
}: {
  workflow: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: detailRes } = useWorkflowDefinition(isExpanded ? workflow.id : undefined);
  const detail = detailRes?.data ?? workflow;
  const steps = detail.steps ?? [];

  const updateDef = useUpdateWorkflowDef();
  const [editing, setEditing] = useState(false);
  const [formState, setFormState] = useState({
    defaultTransmitDelay: workflow.defaultTransmitDelay ?? 72,
    defaultValidationDelay: workflow.defaultValidationDelay ?? 48,
    autoTransmitEnabled: workflow.autoTransmitEnabled ?? false,
    autoValidateEnabled: workflow.autoValidateEnabled ?? false,
    requireComment: workflow.requireComment ?? false,
    allowReject: workflow.allowReject ?? true,
    allowReturn: workflow.allowReturn ?? true,
  });

  const handleSave = async () => {
    await updateDef.mutateAsync({ id: workflow.id, ...formState });
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {i18n(workflow.name)}
            </h3>
            <p className="text-xs text-gray-500">
              {i18n(workflow.country?.name)} &middot; {(workflow.steps ?? []).length || '?'} steps
              &middot; Level {workflow.startLevel} &rarr; {workflow.endLevel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workflow.autoTransmitEnabled && (
            <span className="rounded bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
              Auto-Transmit
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-6">
          {/* Settings */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Settings</h4>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateDef.isPending}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" /> Save
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <SettingField
                label="Transmit Delay (hours)"
                value={formState.defaultTransmitDelay}
                editing={editing}
                type="number"
                onChange={(v) => setFormState((s) => ({ ...s, defaultTransmitDelay: Number(v) }))}
              />
              <SettingField
                label="Validation Delay (hours)"
                value={formState.defaultValidationDelay}
                editing={editing}
                type="number"
                onChange={(v) => setFormState((s) => ({ ...s, defaultValidationDelay: Number(v) }))}
              />
              <ToggleField
                label="Auto-Transmit"
                value={formState.autoTransmitEnabled}
                editing={editing}
                onChange={(v) => setFormState((s) => ({ ...s, autoTransmitEnabled: v }))}
              />
              <ToggleField
                label="Auto-Validate"
                value={formState.autoValidateEnabled}
                editing={editing}
                onChange={(v) => setFormState((s) => ({ ...s, autoValidateEnabled: v }))}
              />
              <ToggleField
                label="Require Comment"
                value={formState.requireComment}
                editing={editing}
                onChange={(v) => setFormState((s) => ({ ...s, requireComment: v }))}
              />
              <ToggleField
                label="Allow Reject"
                value={formState.allowReject}
                editing={editing}
                onChange={(v) => setFormState((s) => ({ ...s, allowReject: v }))}
              />
              <ToggleField
                label="Allow Return"
                value={formState.allowReturn}
                editing={editing}
                onChange={(v) => setFormState((s) => ({ ...s, allowReturn: v }))}
              />
            </div>
          </div>

          {/* Steps */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Validation Steps
            </h4>
            <StepsList workflowId={workflow.id} steps={steps} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Setting fields ── */

function SettingField({
  label,
  value,
  editing,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string | number;
  editing: boolean;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
      ) : (
        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{value}</p>
      )}
    </div>
  );
}

function ToggleField({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: boolean;
  editing: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {editing ? (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              value ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>
      ) : (
        <span className={cn(
          'text-xs font-medium',
          value ? 'text-green-600' : 'text-gray-400',
        )}>
          {value ? 'Enabled' : 'Disabled'}
        </span>
      )}
    </div>
  );
}

/* ── Steps List ── */

function StepsList({ workflowId, steps }: { workflowId: string; steps: any[] }) {
  const createStep = useCreateWorkflowStep();
  const updateStep = useUpdateWorkflowStep();
  const deleteStep = useDeleteWorkflowStep();

  const [showAdd, setShowAdd] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [newStep, setNewStep] = useState({
    stepOrder: steps.length,
    levelType: 'admin1',
    adminLevel: 1,
    nameEn: '',
    nameFr: '',
    canEdit: false,
    canValidate: true,
    transmitDelayHours: '',
  });

  const sorted = [...steps].sort((a: any, b: any) => a.stepOrder - b.stepOrder);

  const handleAddStep = async () => {
    await createStep.mutateAsync({
      workflowId,
      stepOrder: newStep.stepOrder,
      levelType: newStep.levelType,
      adminLevel: newStep.levelType === 'national' ? null : newStep.adminLevel,
      name: { en: newStep.nameEn, fr: newStep.nameFr },
      canEdit: newStep.canEdit,
      canValidate: newStep.canValidate,
      transmitDelayHours: newStep.transmitDelayHours ? Number(newStep.transmitDelayHours) : null,
    });
    setShowAdd(false);
    setNewStep({
      stepOrder: steps.length + 1,
      levelType: 'admin1',
      adminLevel: 1,
      nameEn: '',
      nameFr: '',
      canEdit: false,
      canValidate: true,
      transmitDelayHours: '',
    });
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Delete this step?')) return;
    await deleteStep.mutateAsync({ workflowId, stepId });
  };

  return (
    <div className="space-y-2">
      {sorted.map((step: any, idx: number) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-700 dark:text-blue-300">
              {step.stepOrder}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {i18n(step.name)}
              </p>
              <p className="text-xs text-gray-500">
                {step.levelType} {step.adminLevel != null ? `(level ${step.adminLevel})` : ''}
                {step.canEdit && ' · Can Edit'}
                {step.canValidate && ' · Can Validate'}
                {step.transmitDelayHours && ` · ${step.transmitDelayHours}h delay`}
              </p>
            </div>
            <button
              onClick={() => handleDeleteStep(step.id)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {idx < sorted.length - 1 && (
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-gray-300 dark:text-gray-600" />
            </div>
          )}
        </React.Fragment>
      ))}

      {/* Add step form */}
      {showAdd ? (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Name (EN)</label>
              <input
                value={newStep.nameEn}
                onChange={(e) => setNewStep((s) => ({ ...s, nameEn: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                placeholder="County Validation"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Name (FR)</label>
              <input
                value={newStep.nameFr}
                onChange={(e) => setNewStep((s) => ({ ...s, nameFr: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                placeholder="Validation Comté"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Level Type</label>
              <select
                value={newStep.levelType}
                onChange={(e) => setNewStep((s) => ({ ...s, levelType: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
              >
                {LEVEL_TYPES.map((lt) => (
                  <option key={lt} value={lt}>{lt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Admin Level</label>
              <input
                type="number"
                value={newStep.adminLevel}
                onChange={(e) => setNewStep((s) => ({ ...s, adminLevel: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                disabled={newStep.levelType === 'national'}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Step Order</label>
              <input
                type="number"
                value={newStep.stepOrder}
                onChange={(e) => setNewStep((s) => ({ ...s, stepOrder: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Transmit Delay (hours)</label>
              <input
                type="number"
                value={newStep.transmitDelayHours}
                onChange={(e) => setNewStep((s) => ({ ...s, transmitDelayHours: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={newStep.canEdit}
                onChange={(e) => setNewStep((s) => ({ ...s, canEdit: e.target.checked }))}
                className="rounded"
              />
              Can Edit
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={newStep.canValidate}
                onChange={(e) => setNewStep((s) => ({ ...s, canValidate: e.target.checked }))}
                className="rounded"
              />
              Can Validate
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStep}
              disabled={!newStep.nameEn || createStep.isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createStep.isPending ? 'Adding...' : 'Add Step'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          <Plus className="mr-1 inline h-3 w-3" /> Add Step
        </button>
      )}
    </div>
  );
}

/* ── Create Workflow Form ── */

function CreateWorkflowForm({ onClose }: { onClose: () => void }) {
  const createDef = useCreateWorkflowDef();
  const [form, setForm] = useState({
    countryCode: '',
    nameEn: '',
    nameFr: '',
    descEn: '',
    descFr: '',
    startLevel: 5,
    endLevel: 0,
    defaultTransmitDelay: 72,
    defaultValidationDelay: 48,
    autoTransmitEnabled: true,
    autoValidateEnabled: false,
  });

  const handleCreate = async () => {
    await createDef.mutateAsync({
      countryCode: form.countryCode,
      name: { en: form.nameEn, fr: form.nameFr },
      description: { en: form.descEn, fr: form.descFr },
      startLevel: form.startLevel,
      endLevel: form.endLevel,
      defaultTransmitDelay: form.defaultTransmitDelay,
      defaultValidationDelay: form.defaultValidationDelay,
      autoTransmitEnabled: form.autoTransmitEnabled,
      autoValidateEnabled: form.autoValidateEnabled,
    });
    onClose();
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Workflow Definition</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Country Code (ISO 2)</label>
          <input
            value={form.countryCode}
            onChange={(e) => setForm((s) => ({ ...s, countryCode: e.target.value.toUpperCase() }))}
            maxLength={2}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm uppercase"
            placeholder="KE"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Name (EN)</label>
          <input
            value={form.nameEn}
            onChange={(e) => setForm((s) => ({ ...s, nameEn: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
            placeholder="Kenya Validation Workflow"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Name (FR)</label>
          <input
            value={form.nameFr}
            onChange={(e) => setForm((s) => ({ ...s, nameFr: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
            placeholder="Workflow de Validation Kenya"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Start Level</label>
          <input
            type="number"
            value={form.startLevel}
            onChange={(e) => setForm((s) => ({ ...s, startLevel: Number(e.target.value) }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">End Level</label>
          <input
            type="number"
            value={form.endLevel}
            onChange={(e) => setForm((s) => ({ ...s, endLevel: Number(e.target.value) }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Transmit Delay (h)</label>
          <input
            type="number"
            value={form.defaultTransmitDelay}
            onChange={(e) => setForm((s) => ({ ...s, defaultTransmitDelay: Number(e.target.value) }))}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!form.countryCode || !form.nameEn || createDef.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createDef.isPending ? 'Creating...' : 'Create Workflow'}
        </button>
      </div>
    </div>
  );
}
