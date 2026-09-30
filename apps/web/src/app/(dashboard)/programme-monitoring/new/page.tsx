'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Briefcase, Save, Loader2, Plus, Trash2,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useCreateProgramme } from '@/lib/api/programme-monitoring-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';

// ── Types ──

interface MultilingualValue { [key: string]: string }

interface ComponentInput {
  code: string;
  name: MultilingualValue;
  description: MultilingualValue;
  color: string;
  outputs: OutputInput[];
  collapsed: boolean;
}

interface OutputInput {
  code: string;
  name: MultilingualValue;
  description: MultilingualValue;
  approvedBudget: number;
}

interface DonorInput {
  donorName: string;
  donorReference: string;
  amount: string;
  currency: string;
}

const COMPONENT_COLORS = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0d9488', '#6366f1'];
const CURRENCIES = ['EUR', 'USD', 'XOF', 'XAF', 'KES', 'ZAR', 'GBP', 'CHF'];
const EMPTY_ML: MultilingualValue = { en: '', fr: '', pt: '', ar: '', es: '', sw: '' };

export default function NewProgrammePage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = useTranslations('settings');
  const createMutation = useCreateProgramme();

  // ── Form state ──
  const [code, setCode] = useState('');
  const [name, setName] = useState<MultilingualValue>({ ...EMPTY_ML });
  const [description, setDescription] = useState<MultilingualValue>({ ...EMPTY_ML });
  const [donors, setDonors] = useState<DonorInput[]>([]);
  const [currency, setCurrency] = useState('EUR');
  const [totalBudget, setTotalBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('DESIGN');
  const [level, setLevel] = useState('CONTINENTAL');
  const [logframeType, setLogframeType] = useState('LOGFRAME');
  const [reportingFrequency, setReportingFrequency] = useState('MONTHLY');
  const [components, setComponents] = useState<ComponentInput[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Validation ──
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Programme code is required';
    if (!name.en?.trim()) e.name = 'English name is required';
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate) e.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) e.endDate = 'End date must be after start date';
    if (!totalBudget || Number(totalBudget) < 0) e.totalBudget = 'Valid budget is required';

    components.forEach((comp, ci) => {
      if (!comp.code.trim()) e[`comp_${ci}_code`] = 'Required';
      if (!comp.name.en?.trim()) e[`comp_${ci}_name`] = 'Required';
      comp.outputs.forEach((out, oi) => {
        if (!out.code.trim()) e[`out_${ci}_${oi}_code`] = 'Required';
        if (!out.name.en?.trim()) e[`out_${ci}_${oi}_name`] = 'Required';
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!validate()) return;

    const cleanMl = (v: MultilingualValue) => {
      const result: any = {};
      for (const [k, val] of Object.entries(v)) {
        if (val?.trim()) result[k] = val.trim();
      }
      return Object.keys(result).length > 0 ? result : undefined;
    };

    const body: any = {
      code: code.trim(),
      name: cleanMl(name),
      totalBudget: Number(totalBudget),
      startDate,
      endDate,
      status,
      level,
      logframeType,
      reportingFrequency,
      currency,
    };

    const desc = cleanMl(description);
    if (desc) body.description = desc;

    // Multi-donor support
    if (donors.length > 0) {
      body.donors = donors
        .filter((d) => d.donorName.trim())
        .map((d) => ({
          donorName: d.donorName.trim(),
          donorReference: d.donorReference.trim() || undefined,
          amount: Number(d.amount) || 0,
          currency: d.currency || currency,
        }));
    }

    if (components.length > 0) {
      body.components = components.map((comp) => ({
        code: comp.code.trim(),
        name: cleanMl(comp.name),
        ...(cleanMl(comp.description) ? { description: cleanMl(comp.description) } : {}),
        color: comp.color,
        outputs: comp.outputs.map((out) => ({
          code: out.code.trim(),
          name: cleanMl(out.name),
          ...(cleanMl(out.description) ? { description: cleanMl(out.description) } : {}),
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
      name: { ...EMPTY_ML },
      description: { ...EMPTY_ML },
      color: COMPONENT_COLORS[idx % COMPONENT_COLORS.length],
      outputs: [],
      collapsed: false,
    }]);
  }

  function updateComponent(index: number, updates: Partial<ComponentInput>) {
    const updated = [...components];
    updated[index] = { ...updated[index], ...updates };
    setComponents(updated);
  }

  function removeComponent(index: number) {
    setComponents(components.filter((_, i) => i !== index));
  }

  function addOutput(compIndex: number) {
    const updated = [...components];
    const comp = updated[compIndex];
    const outIdx = comp.outputs.length;
    comp.outputs.push({
      code: `${comp.code}.${outIdx + 1}`,
      name: { ...EMPTY_ML },
      description: { ...EMPTY_ML },
      approvedBudget: 0,
    });
    setComponents(updated);
  }

  function updateOutput(compIndex: number, outIndex: number, updates: Partial<OutputInput>) {
    const updated = [...components];
    updated[compIndex].outputs[outIndex] = { ...updated[compIndex].outputs[outIndex], ...updates };
    setComponents(updated);
  }

  function removeOutput(compIndex: number, outIndex: number) {
    const updated = [...components];
    updated[compIndex].outputs = updated[compIndex].outputs.filter((_, i) => i !== outIndex);
    setComponents(updated);
  }

  const totalOutputBudget = components.reduce(
    (s, c) => s + c.outputs.reduce((so, o) => so + (o.approvedBudget || 0), 0), 0
  );

  return (
    <div className="animate-in fade-in duration-200">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b bg-white/95 backdrop-blur px-6 py-4 dark:bg-gray-950/95 dark:border-gray-800">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/programme-monitoring')}
              className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                New Programme
              </h1>
              <p className="text-xs text-gray-500">Fill in the details below to create a new programme</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/programme-monitoring')}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {createMutation.isPending ? 'Creating...' : 'Create Programme'}
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {errors.submit && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*  Section 1: General Information                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <FormSection title="General Information" description="Core programme identification and naming" number={1}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Field label="Programme Code" required error={errors.code}>
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
            <Field label="Level">
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass()}>
                <option value="CONTINENTAL">Continental</option>
                <option value="REGIONAL">Regional</option>
                <option value="NATIONAL">National</option>
              </select>
            </Field>
          </div>

          <MultilingualInput
            label="Programme Name"
            value={name}
            onChange={setName}
            required
            placeholder="Pan-African PPR Eradication Programme - Phase 2"
            error={errors.name}
          />

          <MultilingualTextarea
            label="Description"
            value={description}
            onChange={setDescription}
            rows={3}
            placeholder="Brief description of the programme objectives and scope..."
          />
        </FormSection>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*  Section 2: Funding & Period                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <FormSection title="Funding & Period" description="Budget allocation, donor information and timeline" number={2}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Field label="Total Budget" required error={errors.totalBudget}>
              <div className="relative">
                <input
                  type="number"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  placeholder="2,809,240"
                  min={0}
                  step={0.01}
                  className={`${inputClass(errors.totalBudget)} pr-20`}
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="absolute right-1 top-1 bottom-1 rounded-md border-0 bg-gray-100 px-2 text-xs font-medium dark:bg-gray-700 dark:text-white"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Start Date" required error={errors.startDate}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass(errors.startDate)} />
            </Field>
            <Field label="End Date" required error={errors.endDate}>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass(errors.endDate)} />
            </Field>
          </div>

          {/* ── Donors (multi) ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Donors / Funding Sources</label>
              <button
                type="button"
                onClick={() => setDonors([...donors, { donorName: '', donorReference: '', amount: '', currency }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Donor
              </button>
            </div>
            {donors.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-8 text-center">
                <p className="text-sm text-gray-400">No donors added yet</p>
                <button
                  type="button"
                  onClick={() => setDonors([{ donorName: '', donorReference: '', amount: '', currency }])}
                  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus className="inline h-4 w-4 mr-1" />Add first donor
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {donors.map((donor, idx) => (
                  <div key={idx} className="relative rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                    <button
                      type="button"
                      onClick={() => setDonors(donors.filter((_, i) => i !== idx))}
                      className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 transition"
                      title="Remove donor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 pr-8">
                      <Field label="Donor Name" required>
                        <input
                          value={donor.donorName}
                          onChange={(e) => {
                            const next = [...donors];
                            next[idx] = { ...next[idx], donorName: e.target.value };
                            setDonors(next);
                          }}
                          placeholder="e.g. European Union"
                          className={inputClass()}
                        />
                      </Field>
                      <Field label="Reference / Contract No.">
                        <input
                          value={donor.donorReference}
                          onChange={(e) => {
                            const next = [...donors];
                            next[idx] = { ...next[idx], donorReference: e.target.value };
                            setDonors(next);
                          }}
                          placeholder="e.g. FED/2024/PPR-P2"
                          className={inputClass()}
                        />
                      </Field>
                      <Field label="Amount">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={donor.amount}
                            onChange={(e) => {
                              const next = [...donors];
                              next[idx] = { ...next[idx], amount: e.target.value };
                              setDonors(next);
                            }}
                            placeholder="0.00"
                            className={`${inputClass()} pr-16`}
                          />
                          <select
                            value={donor.currency}
                            onChange={(e) => {
                              const next = [...donors];
                              next[idx] = { ...next[idx], currency: e.target.value };
                              setDonors(next);
                            }}
                            className="absolute right-1 top-1 bottom-1 rounded-md border-0 bg-gray-100 px-2 text-xs font-medium dark:bg-gray-700 dark:text-white"
                          >
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*  Section 3: Configuration                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <FormSection title="Configuration" description="Framework type, reporting frequency and scope" number={3}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Field label="Logframe Type">
              <select value={logframeType} onChange={(e) => setLogframeType(e.target.value)} className={inputClass()}>
                <option value="LOGFRAME">Logical Framework (Logframe)</option>
                <option value="RESULTS_FRAMEWORK">Results Framework</option>
                <option value="THEORY_OF_CHANGE">Theory of Change</option>
              </select>
            </Field>
            <Field label="Reporting Frequency">
              <select value={reportingFrequency} onChange={(e) => setReportingFrequency(e.target.value)} className={inputClass()}>
                <option value="WEEKLY">Weekly (every Friday)</option>
                <option value="BIWEEKLY">Bi-weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </Field>
          </div>
        </FormSection>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*  Section 4: Logical Framework                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <FormSection
          title="Logical Framework"
          description="Define components (outcomes) and their outputs. Activities can be added after creation."
          number={4}
          action={
            <button
              onClick={addComponent}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Component
            </button>
          }
        >
          {components.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed py-12 text-center dark:border-gray-700">
              <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No components defined yet</p>
              <p className="text-xs text-gray-400 mt-1">Structure your programme into outcomes and outputs</p>
              <button onClick={addComponent} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                <Plus className="h-4 w-4" /> Add first component
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {components.map((comp, ci) => (
                <div key={ci} className="rounded-xl border overflow-hidden dark:border-gray-700">
                  {/* Component header bar */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50"
                    style={{ borderLeft: `4px solid ${comp.color}` }}
                  >
                    <button onClick={() => updateComponent(ci, { collapsed: !comp.collapsed })} className="text-gray-400 hover:text-gray-600 transition">
                      {comp.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: comp.color }}
                    >
                      {comp.code || ci + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {comp.name.en || `Component ${ci + 1}`}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {comp.outputs.length} output{comp.outputs.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <input
                      type="color"
                      value={comp.color}
                      onChange={(e) => updateComponent(ci, { color: e.target.value })}
                      className="h-7 w-7 rounded cursor-pointer border-0 bg-transparent"
                    />

                    <button onClick={() => removeComponent(ci)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Component body */}
                  {!comp.collapsed && (
                    <div className="p-5 space-y-5">
                      {/* Code on its own row */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field label="Code" required error={errors[`comp_${ci}_code`]}>
                          <input
                            value={comp.code}
                            onChange={(e) => updateComponent(ci, { code: e.target.value })}
                            placeholder="1"
                            className={`${inputClass(errors[`comp_${ci}_code`])} font-mono`}
                          />
                        </Field>
                      </div>

                      {/* Name on its own full-width row */}
                      <MultilingualInput
                        label="Component Name"
                        value={comp.name}
                        onChange={(v) => updateComponent(ci, { name: v })}
                        required
                        placeholder="Governance & Coordination"
                        error={errors[`comp_${ci}_name`]}
                      />

                      {/* Description on its own full-width row */}
                      <MultilingualTextarea
                        label="Component Description"
                        value={comp.description}
                        onChange={(v) => updateComponent(ci, { description: v })}
                        rows={2}
                        placeholder="Describe this component's objectives..."
                      />

                      {/* Outputs */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outputs</h4>
                          <button
                            onClick={() => addOutput(ci)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            <Plus className="h-3 w-3" /> Add Output
                          </button>
                        </div>

                        {comp.outputs.length === 0 ? (
                          <div className="rounded-lg border border-dashed py-6 text-center dark:border-gray-700">
                            <p className="text-xs text-gray-400">No outputs yet</p>
                            <button onClick={() => addOutput(ci)} className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                              + Add first output
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {comp.outputs.map((out, oi) => (
                              <div key={oi} className="rounded-lg border bg-gray-50/50 p-4 dark:bg-gray-800/30 dark:border-gray-700">
                                {/* Output header: badge + code + budget + delete */}
                                <div className="flex items-center gap-3 mb-4">
                                  <span className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: comp.color }}>
                                    {oi + 1}
                                  </span>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1">
                                    <Field label="Code" required error={errors[`out_${ci}_${oi}_code`]}>
                                      <input
                                        value={out.code}
                                        onChange={(e) => updateOutput(ci, oi, { code: e.target.value })}
                                        placeholder={`${comp.code}.${oi + 1}`}
                                        className={`${inputClass(errors[`out_${ci}_${oi}_code`])} font-mono`}
                                      />
                                    </Field>
                                    <Field label={`Budget (${currency})`}>
                                      <input
                                        type="number"
                                        value={out.approvedBudget || ''}
                                        onChange={(e) => updateOutput(ci, oi, { approvedBudget: Number(e.target.value) })}
                                        placeholder="0"
                                        min={0}
                                        className={`${inputClass()} text-right tabular-nums`}
                                      />
                                    </Field>
                                  </div>
                                  <button onClick={() => removeOutput(ci, oi)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {/* Output Name — full width on its own row */}
                                <div className="space-y-4">
                                  <MultilingualInput
                                    label="Output Name"
                                    value={out.name}
                                    onChange={(v) => updateOutput(ci, oi, { name: v })}
                                    required
                                    placeholder="Surveillance & data"
                                    error={errors[`out_${ci}_${oi}_name`]}
                                  />

                                  {/* Output Description — full width on its own row */}
                                  <MultilingualTextarea
                                    label="Output Description"
                                    value={out.description}
                                    onChange={(v) => updateOutput(ci, oi, { description: v })}
                                    rows={2}
                                    placeholder="Expected deliverables and outcomes..."
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Budget allocation summary */}
              {totalOutputBudget > 0 && (
                <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-5 py-3 dark:bg-gray-800/50 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total output budgets allocated</span>
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                      {totalOutputBudget.toLocaleString()} {currency}
                    </span>
                    {totalBudget && Number(totalBudget) > 0 && (
                      <span className={`ml-3 text-sm font-medium ${totalOutputBudget > Number(totalBudget) ? 'text-red-500' : 'text-emerald-600'}`}>
                        ({Math.round((totalOutputBudget / Number(totalBudget)) * 100)}% of total budget)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </FormSection>

        {/* ── Bottom Actions ── */}
        <div className="flex items-center justify-between border-t pt-8 pb-4 dark:border-gray-800">
          <button
            onClick={() => router.push('/programme-monitoring')}
            className="rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {createMutation.isPending ? 'Creating...' : 'Create Programme'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Reusable form components
// ══════════════════════════════════════════════════════════════════════════════

function FormSection({ title, description, number, action, children }: {
  title: string;
  description?: string;
  number?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-start justify-between border-b px-6 py-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {number && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              {number}
            </span>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-5 p-6">
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputClass(error?: string): string {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none shadow-sm transition ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
      : 'border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
  }`;
}
