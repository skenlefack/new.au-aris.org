'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Briefcase, Save, Loader2, Plus, Trash2,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useProgramme, useUpdateProgramme } from '@/lib/api/programme-monitoring-hooks';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useTranslations } from '@/lib/i18n/translations';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';

interface MultilingualValue { [key: string]: string }

const CURRENCIES = ['EUR', 'USD', 'XOF', 'XAF', 'KES', 'ZAR', 'GBP', 'CHF'];
const EMPTY_ML: MultilingualValue = { en: '', fr: '', pt: '', ar: '', es: '', sw: '' };

function toDateStr(d: any): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

function toMl(v: any): MultilingualValue {
  if (!v) return { ...EMPTY_ML };
  if (typeof v === 'string') return { ...EMPTY_ML, en: v };
  return { ...EMPTY_ML, ...v };
}

export default function EditProgrammePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = useTranslations('settings');
  const { data: progRes, isLoading } = useProgramme(id);
  const updateMutation = useUpdateProgramme();

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState<MultilingualValue>({ ...EMPTY_ML });
  const [description, setDescription] = useState<MultilingualValue>({ ...EMPTY_ML });
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  // Populate form from fetched data
  useEffect(() => {
    const prog = progRes?.data;
    if (prog && !initialized) {
      setCode(prog.code || '');
      setName(toMl(prog.name));
      setDescription(toMl(prog.description));
      setDonorName(prog.donorName || prog.donors?.[0]?.donorName || '');
      setDonorReference(prog.donorReference || prog.donors?.[0]?.donorReference || '');
      setCurrency(prog.currency || 'EUR');
      setTotalBudget(String(Number(prog.totalBudget) || ''));
      setStartDate(toDateStr(prog.startDate));
      setEndDate(toDateStr(prog.endDate));
      setStatus(prog.status || 'DESIGN');
      setLevel(prog.level || 'CONTINENTAL');
      setLogframeType(prog.logframeType || 'LOGFRAME');
      setReportingFrequency(prog.reportingFrequency || 'MONTHLY');
      setInitialized(true);
    }
  }, [progRes, initialized]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Programme code is required';
    if (!name.en?.trim()) e.name = 'English name is required';
    if (!startDate) e.startDate = 'Start date is required';
    if (!endDate) e.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) e.endDate = 'End date must be after start date';
    if (!totalBudget || Number(totalBudget) < 0) e.totalBudget = 'Valid budget is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

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
      id,
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
    if (donorName.trim()) body.donorName = donorName.trim();
    if (donorReference.trim()) body.donorReference = donorReference.trim();

    try {
      await updateMutation.mutateAsync(body);
      router.push(`/programme-monitoring/${id}`);
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Failed to update programme' });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl">
        <div className="h-12 w-64 rounded-lg bg-gray-200 dark:bg-gray-800" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 space-y-4">
            <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-10 w-full rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-10 w-full rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    );
  }

  const progName = name.en || name[locale] || 'Programme';

  return (
    <div className="animate-in fade-in duration-200">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b bg-white/95 backdrop-blur px-6 py-4 dark:bg-gray-950/95 dark:border-gray-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/programme-monitoring/${id}`)}
              className="rounded-lg border p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                Edit: {progName}
              </h1>
              <p className="text-xs text-gray-500">{code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/programme-monitoring/${id}`)}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {errors.submit && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Section 1: General */}
        <FormSection title="General Information" number={1}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Field label="Programme Code" required error={errors.code}>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PPR-P2" className={inputClass(errors.code)} />
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
          <MultilingualInput label="Programme Name" value={name} onChange={setName} required placeholder="Programme name" error={errors.name} />
          <MultilingualTextarea label="Description" value={description} onChange={setDescription} rows={3} placeholder="Programme description..." />
        </FormSection>

        {/* Section 2: Funding */}
        <FormSection title="Funding & Period" number={2}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Field label="Total Budget" required error={errors.totalBudget}>
              <div className="relative">
                <input type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="0" min={0} className={`${inputClass(errors.totalBudget)} pr-20`} />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="absolute right-1 top-1 bottom-1 rounded-md border-0 bg-gray-100 px-2 text-xs font-medium dark:bg-gray-700 dark:text-white">
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
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Field label="Donor Name">
              <input value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="European Union" className={inputClass()} />
            </Field>
            <Field label="Donor Reference">
              <input value={donorReference} onChange={(e) => setDonorReference(e.target.value)} placeholder="FED/2024/PPR-P2" className={inputClass()} />
            </Field>
          </div>
        </FormSection>

        {/* Section 3: Configuration */}
        <FormSection title="Configuration" number={3}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
          </div>
        </FormSection>

        {/* Bottom actions */}
        <div className="flex items-center justify-between border-t pt-8 pb-4 dark:border-gray-800">
          <button onClick={() => router.push(`/programme-monitoring/${id}`)} className="rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, number, children }: { title: string; number?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center gap-3 border-b px-6 py-4 dark:border-gray-800">
        {number && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{number}</span>}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputClass(error?: string): string {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none shadow-sm transition ${
    error ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
      : 'border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
  }`;
}
