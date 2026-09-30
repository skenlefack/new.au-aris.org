'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Briefcase, Save, Loader2, Plus, Trash2,
  ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react';
import { useCreateProgramme } from '@/lib/api/programme-monitoring-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';

interface ComponentInput {
  code: string;
  name: { en: string; fr: string };
  color: string;
  outputs: OutputInput[];
  collapsed: boolean;
}

interface OutputInput {
  code: string;
  name: { en: string; fr: string };
  approvedBudget: number;
}

const COMPONENT_COLORS = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0d9488', '#6366f1'];

const CURRENCIES = ['EUR', 'USD', 'XOF', 'XAF', 'KES', 'ZAR', 'GBP', 'CHF'];

export default function NewProgrammePage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const createMutation = useCreateProgramme();

  // ── Form state ──
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descFr, setDescFr] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorReference, setDonorReference] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [totalBudget, setTotalBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('DESIGN');
  const [level, setLevel] = useState('CONTINENTAL');
  const [logframeType, setLogframeType] = useState('LOGFRAME');
  const [reportingFrequency, setReportingFrequency] = useState('MONTHLY');

  // Components + outputs
  const [components, setComponents] = useState<ComponentInput[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Validation ──
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Programme code is required';
    if (!nameEn.trim()) e.nameEn = 'English name is required';
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate) e.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) e.endDate = 'End date must be after start date';
    if (!totalBudget || Number(totalBudget) < 0) e.totalBudget = 'Valid budget is required';

    // Validate components
    components.forEach((comp, ci) => {
      if (!comp.code.trim()) e[`comp_${ci}_code`] = 'Code required';
      if (!comp.name.en.trim()) e[`comp_${ci}_name`] = 'Name required';
      comp.outputs.forEach((out, oi) => {
        if (!out.code.trim()) e[`comp_${ci}_out_${oi}_code`] = 'Code required';
        if (!out.name.en.trim()) e[`comp_${ci}_out_${oi}_name`] = 'Name required';
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!validate()) return;

    const body: any = {
      code: code.trim(),
      name: { en: nameEn.trim(), fr: nameFr.trim() || undefined },
      totalBudget: Number(totalBudget),
      startDate,
      endDate,
      status,
      level,
      logframeType,
      reportingFrequency,
      currency,
    };

    if (descEn.trim()) body.description = { en: descEn.trim(), fr: descFr.trim() || undefined };
    if (donorName.trim()) body.donorName = donorName.trim();
    if (donorReference.trim()) body.donorReference = donorReference.trim();

    if (components.length > 0) {
      body.components = components.map((comp) => ({
        code: comp.code.trim(),
        name: { en: comp.name.en.trim(), fr: comp.name.fr.trim() || undefined },
        color: comp.color,
        outputs: comp.outputs.map((out) => ({
          code: out.code.trim(),
          name: { en: out.name.en.trim(), fr: out.name.fr.trim() || undefined },
          approvedBudget: out.approvedBudget || 0,
        })),
      }));
    }

    try {
      const result = await createMutation.mutateAsync(body);
      const newId = result?.data?.id;
      router.push(newId ? `/programme-monitoring/${newId}` : '/programme-monitoring');
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Failed to create programme' });
    }
  }

  // ── Component helpers ──
  function addComponent() {
    const idx = components.length;
    setComponents([...components, {
      code: `${idx + 1}`,
      name: { en: '', fr: '' },
      color: COMPONENT_COLORS[idx % COMPONENT_COLORS.length],
      outputs: [],
      collapsed: false,
    }]);
  }

  function updateComponent(index: number, field: string, value: any) {
    const updated = [...components];
    (updated[index] as any)[field] = value;
    setComponents(updated);
  }

  function removeComponent(index: number) {
    setComponents(components.filter((_, i) => i !== index));
  }

  function toggleComponent(index: number) {
    const updated = [...components];
    updated[index].collapsed = !updated[index].collapsed;
    setComponents(updated);
  }

  function addOutput(compIndex: number) {
    const updated = [...components];
    const comp = updated[compIndex];
    const outIdx = comp.outputs.length;
    comp.outputs.push({
      code: `${comp.code}.${outIdx + 1}`,
      name: { en: '', fr: '' },
      approvedBudget: 0,
    });
    setComponents(updated);
  }

  function updateOutput(compIndex: number, outIndex: number, field: string, value: any) {
    const updated = [...components];
    (updated[compIndex].outputs[outIndex] as any)[field] = value;
    setComponents(updated);
  }

  function removeOutput(compIndex: number, outIndex: number) {
    const updated = [...components];
    updated[compIndex].outputs = updated[compIndex].outputs.filter((_, i) => i !== outIndex);
    setComponents(updated);
  }

  // ── Computed ──
  const totalOutputBudget = components.reduce(
    (s, c) => s + c.outputs.reduce((so, o) => so + (o.approvedBudget || 0), 0), 0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/programme-monitoring')}
          className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            New Programme
          </h1>
          <p className="text-sm text-gray-500">Create a new programme to track activities, budgets & indicators</p>
        </div>
      </div>

      {/* Error banner */}
      {errors.submit && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      {/* ── Section 1: General Information ── */}
      <FormSection title="General Information" description="Core programme identification">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Programme Code *" error={errors.code}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PPR-P2"
              maxLength={50}
              className={inputClass(errors.code)}
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass()}>
              <option value="DESIGN">Design</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
        </div>

        <Field label="Programme Name (EN) *" error={errors.nameEn}>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Pan-African PPR Eradication Programme - Phase 2" className={inputClass(errors.nameEn)} />
        </Field>
        <Field label="Programme Name (FR)">
          <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Programme Panafricain d'Eradication de la PPR - Phase 2" className={inputClass()} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Description (EN)">
            <textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={2} placeholder="Brief description..." className={inputClass()} />
          </Field>
          <Field label="Description (FR)">
            <textarea value={descFr} onChange={(e) => setDescFr(e.target.value)} rows={2} placeholder="Description courte..." className={inputClass()} />
          </Field>
        </div>
      </FormSection>

      {/* ── Section 2: Funding & Period ── */}
      <FormSection title="Funding & Period" description="Budget, donor and timeline">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Total Budget *" error={errors.totalBudget}>
            <div className="relative">
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="2809240"
                min={0}
                step={0.01}
                className={`${inputClass(errors.totalBudget)} pr-16`}
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="absolute right-1 top-1 bottom-1 rounded-md border-0 bg-gray-100 px-2 text-xs font-medium dark:bg-gray-700"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Start Date *" error={errors.startDate}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass(errors.startDate)} />
          </Field>
          <Field label="End Date *" error={errors.endDate}>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass(errors.endDate)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Donor Name">
            <input value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="European Union" className={inputClass()} />
          </Field>
          <Field label="Donor Reference">
            <input value={donorReference} onChange={(e) => setDonorReference(e.target.value)} placeholder="FED/2024/PPR-P2" className={inputClass()} />
          </Field>
        </div>
      </FormSection>

      {/* ── Section 3: Configuration ── */}
      <FormSection title="Configuration" description="Framework type, reporting and scope">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Logframe Type">
            <select value={logframeType} onChange={(e) => setLogframeType(e.target.value)} className={inputClass()}>
              <option value="LOGFRAME">Logical Framework</option>
              <option value="RESULTS_FRAMEWORK">Results Framework</option>
              <option value="THEORY_OF_CHANGE">Theory of Change</option>
            </select>
          </Field>
          <Field label="Reporting Frequency">
            <select value={reportingFrequency} onChange={(e) => setReportingFrequency(e.target.value)} className={inputClass()}>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
            </select>
          </Field>
          <Field label="Level">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass()}>
              <option value="CONTINENTAL">Continental</option>
              <option value="REGIONAL">Regional</option>
              <option value="NATIONAL">National</option>
            </select>
          </Field>
        </div>
      </FormSection>

      {/* ── Section 4: Logical Framework (Components → Outputs) ── */}
      <FormSection
        title="Logical Framework"
        description="Define components (outcomes) and their outputs. You can add activities later."
        action={
          <button onClick={addComponent} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400">
            <Plus className="h-3.5 w-3.5" />
            Add Component
          </button>
        }
      >
        {components.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed py-8 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500">No components defined yet</p>
            <p className="text-xs text-gray-400 mt-1">Add components to structure your programme into outcomes and outputs</p>
            <button onClick={addComponent} className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              + Add first component
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {components.map((comp, ci) => (
              <div key={ci} className="rounded-xl border dark:border-gray-700 overflow-hidden">
                {/* Component header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  style={{ borderLeft: `4px solid ${comp.color}` }}
                >
                  <button onClick={() => toggleComponent(ci)} className="text-gray-400">
                    {comp.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-4 items-center">
                    <input
                      value={comp.code}
                      onChange={(e) => updateComponent(ci, 'code', e.target.value)}
                      placeholder="1"
                      className="rounded border px-2 py-1 text-xs font-mono w-16 dark:bg-gray-800 dark:border-gray-700"
                    />
                    <input
                      value={comp.name.en}
                      onChange={(e) => updateComponent(ci, 'name', { ...comp.name, en: e.target.value })}
                      placeholder="Component name (EN)"
                      className="rounded border px-2 py-1 text-sm sm:col-span-2 dark:bg-gray-800 dark:border-gray-700"
                    />
                    <input
                      value={comp.name.fr}
                      onChange={(e) => updateComponent(ci, 'name', { ...comp.name, fr: e.target.value })}
                      placeholder="Nom (FR)"
                      className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700"
                    />
                  </div>

                  <input
                    type="color"
                    value={comp.color}
                    onChange={(e) => updateComponent(ci, 'color', e.target.value)}
                    className="h-7 w-7 rounded cursor-pointer border-0"
                  />

                  <button onClick={() => removeComponent(ci)} className="p-1 text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Outputs */}
                {!comp.collapsed && (
                  <div className="border-t bg-gray-50/50 dark:bg-gray-800/20 dark:border-gray-700">
                    {comp.outputs.length > 0 && (
                      <div className="divide-y dark:divide-gray-700">
                        {comp.outputs.map((out, oi) => (
                          <div key={oi} className="flex items-center gap-2 px-4 py-2 pl-12">
                            <span className="text-[10px] text-gray-400 w-3">&#8627;</span>
                            <input
                              value={out.code}
                              onChange={(e) => updateOutput(ci, oi, 'code', e.target.value)}
                              placeholder={`${comp.code}.${oi + 1}`}
                              className="rounded border px-2 py-1 text-xs font-mono w-16 dark:bg-gray-800 dark:border-gray-700"
                            />
                            <input
                              value={out.name.en}
                              onChange={(e) => updateOutput(ci, oi, 'name', { ...out.name, en: e.target.value })}
                              placeholder="Output name (EN)"
                              className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700"
                            />
                            <input
                              value={out.name.fr}
                              onChange={(e) => updateOutput(ci, oi, 'name', { ...out.name, fr: e.target.value })}
                              placeholder="Nom (FR)"
                              className="flex-1 rounded border px-2 py-1 text-sm hidden sm:block dark:bg-gray-800 dark:border-gray-700"
                            />
                            <div className="relative w-28">
                              <input
                                type="number"
                                value={out.approvedBudget || ''}
                                onChange={(e) => updateOutput(ci, oi, 'approvedBudget', Number(e.target.value))}
                                placeholder="0"
                                min={0}
                                className="w-full rounded border px-2 py-1 text-xs text-right tabular-nums dark:bg-gray-800 dark:border-gray-700"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">{currency}</span>
                            </div>
                            <button onClick={() => removeOutput(ci, oi)} className="p-1 text-gray-400 hover:text-red-500 transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-4 py-2 pl-12">
                      <button
                        onClick={() => addOutput(ci)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        <Plus className="h-3 w-3" />
                        Add Output
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Budget summary */}
            {totalOutputBudget > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5 dark:bg-gray-800/50">
                <span className="text-xs text-gray-500">Total output budgets</span>
                <span className="text-sm font-bold tabular-nums">
                  {totalOutputBudget.toLocaleString()} {currency}
                  {totalBudget && Number(totalBudget) > 0 && (
                    <span className={`ml-2 text-xs font-normal ${totalOutputBudget > Number(totalBudget) ? 'text-red-500' : 'text-gray-400'}`}>
                      ({Math.round((totalOutputBudget / Number(totalBudget)) * 100)}% of total)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </FormSection>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between border-t pt-6 dark:border-gray-800">
        <button
          onClick={() => router.push('/programme-monitoring')}
          className="rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {createMutation.isPending ? 'Creating...' : 'Create Programme'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Reusable form components
// ══════════════════════════════════════════════════════════════════════════════

function FormSection({ title, description, action, children }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputClass(error?: string): string {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
      : 'border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
  }`;
}
