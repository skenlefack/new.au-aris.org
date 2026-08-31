'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FlaskConical,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Save,
  Loader2,
  Download,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFormSubmissions,
  useUpdateSubmission,
  type FormSubmissionListItem,
} from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

interface LabProcessingConfig {
  enabled: boolean;
  resultField: string;
  sampleCodeField: string;
  resultOptions?: Array<{ value: string; label: Record<string, string> }>;
}

interface RepeaterField {
  code: string;
  type: string;
  label: Record<string, string>;
  properties?: {
    labProcessing?: LabProcessingConfig;
    fields?: Array<{
      code: string;
      label: Record<string, string>;
      type: string;
      options?: Array<{ value: string; label: Record<string, string> }>;
    }>;
    repeatMin?: number;
    repeatMax?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface TemplateSection {
  id: string;
  name: Record<string, string>;
  order: number;
  fields: RepeaterField[];
  [key: string]: unknown;
}

export interface LabResultsTabProps {
  campaignId: string;
  templateId: string;
  templateSchema: {
    sections: TemplateSection[];
    [key: string]: unknown;
  };
  locale?: string;
}

type LabStatus = string; // dynamic from config

interface FlatSample {
  submissionId: string;
  submissionCode: string;
  submissionLocation: string;
  submissionSurveyor: string;
  repeaterCode: string;
  rowIndex: number;
  sampleCode: string;
  subFields: Record<string, unknown>;
  currentResult: string;
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

const DEFAULT_RESULT_OPTIONS = [
  { value: 'positive', label: { en: 'Positive', fr: 'Positif', pt: 'Positivo', ar: 'إيجابي' } },
  { value: 'negative', label: { en: 'Negative', fr: 'Négatif', pt: 'Negativo', ar: 'سلبي' } },
  { value: 'doubtful', label: { en: 'Doubtful', fr: 'Douteux', pt: 'Duvidoso', ar: 'مشكوك' } },
];

const RESULT_ICONS: Record<string, React.ElementType> = {
  positive: XCircle,
  negative: CheckCircle2,
  doubtful: HelpCircle,
};

const RESULT_COLORS: Record<string, string> = {
  positive: 'text-red-600 bg-red-50 border-red-200',
  negative: 'text-green-600 bg-green-50 border-green-200',
  doubtful: 'text-amber-600 bg-amber-50 border-amber-200',
};

function i18n(val: unknown, locale = 'en'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj[locale] ?? obj['en'] ?? obj['fr'] ?? Object.values(obj).find((v) => v) ?? '';
  }
  return String(val);
}

function getLocation(data: Record<string, unknown>): string {
  const loc = data?.admin_location as Record<string, unknown> | undefined;
  if (!loc) return '—';
  for (const key of ['level_1_name', 'level_2_name', 'level_3_name']) {
    const val = loc[key];
    if (typeof val === 'string' && val) return val;
  }
  for (const key of ['level_1', 'level_2']) {
    const val = loc[key];
    if (typeof val === 'string' && val) return val;
  }
  return '—';
}

function getSubmissionCode(data: Record<string, unknown>): string {
  return (data?.form_code as string) || (data?.survey_code as string) || '';
}

/** Detect all repeater fields with labProcessing enabled in a template schema */
export function detectLabRepeaters(schema: { sections: TemplateSection[] }): Array<{
  sectionName: Record<string, string>;
  field: RepeaterField;
  config: LabProcessingConfig;
}> {
  const results: Array<{ sectionName: Record<string, string>; field: RepeaterField; config: LabProcessingConfig }> = [];

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type === 'repeater' && field.properties?.labProcessing?.enabled) {
        results.push({
          sectionName: section.name,
          field,
          config: field.properties.labProcessing,
        });
      }
    }
  }

  return results;
}

/* ────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────── */

export default function LabResultsTab({ campaignId, templateId, templateSchema, locale = 'en' }: LabResultsTabProps) {
  const t = useTranslations('collecte');
  // Detect lab repeaters from template schema
  const labRepeaters = useMemo(() => detectLabRepeaters(templateSchema), [templateSchema]);

  // Fetch all submissions for this template
  const { data: subData, isLoading } = useFormSubmissions(templateId, { limit: 500 });
  const submissions = useMemo(() => subData?.data ?? [], [subData]);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [edits, setEdits] = useState<Record<string, string>>({}); // key: "submissionId:repeaterCode:rowIndex"
  const [saved, setSaved] = useState(false);
  const { mutateAsync: updateSubmission, isPending: isSaving } = useUpdateSubmission();

  // Flatten all samples across all submissions
  const flatSamples: FlatSample[] = useMemo(() => {
    const items: FlatSample[] = [];

    for (const sub of submissions) {
      const data = sub.data as Record<string, unknown>;
      const code = getSubmissionCode(data);
      const loc = getLocation(data);
      const surveyor = (data?.surveyor_name as string) || (data?.agent_full_name as string) || '';

      for (const lr of labRepeaters) {
        const repeaterData = data[lr.field.code];
        if (!Array.isArray(repeaterData)) continue;

        const resultField = lr.config.resultField;
        const codeField = lr.config.sampleCodeField;

        for (let i = 0; i < repeaterData.length; i++) {
          const row = repeaterData[i] as Record<string, unknown>;
          items.push({
            submissionId: sub.id,
            submissionCode: code,
            submissionLocation: loc,
            submissionSurveyor: surveyor,
            repeaterCode: lr.field.code,
            rowIndex: i,
            sampleCode: (row[codeField] as string) || `#${i + 1}`,
            subFields: row,
            currentResult: (row[resultField] as string) || '',
          });
        }
      }
    }

    return items;
  }, [submissions, labRepeaters]);

  // Apply edits on top of current results
  const getEffectiveResult = useCallback((sample: FlatSample): string => {
    const key = `${sample.submissionId}:${sample.repeaterCode}:${sample.rowIndex}`;
    return edits[key] ?? sample.currentResult;
  }, [edits]);

  // Filter
  const filteredSamples = useMemo(() => {
    let items = flatSamples;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((s) =>
        s.sampleCode.toLowerCase().includes(q) ||
        s.submissionCode.toLowerCase().includes(q) ||
        s.submissionLocation.toLowerCase().includes(q) ||
        s.submissionSurveyor.toLowerCase().includes(q),
      );
    }

    if (statusFilter === 'pending') {
      items = items.filter((s) => !getEffectiveResult(s));
    } else if (statusFilter === 'completed') {
      items = items.filter((s) => !!getEffectiveResult(s));
    }

    return items;
  }, [flatSamples, searchQuery, statusFilter, getEffectiveResult]);

  // Stats
  const totalSamples = flatSamples.length;
  const completedCount = flatSamples.filter((s) => !!getEffectiveResult(s)).length;
  const pendingCount = totalSamples - completedCount;
  const hasEdits = Object.keys(edits).length > 0;

  // Get sub-field columns to display (exclude the result field itself)
  const displayColumns = useMemo(() => {
    if (labRepeaters.length === 0) return [];
    const lr = labRepeaters[0];
    const subFields = lr.field.properties?.fields ?? [];
    return subFields.filter((f) => f.code !== lr.config.resultField && f.code !== lr.config.sampleCodeField);
  }, [labRepeaters]);

  // Result options
  const resultOptions = useMemo(() => {
    if (labRepeaters.length === 0) return DEFAULT_RESULT_OPTIONS;
    return labRepeaters[0].config.resultOptions ?? DEFAULT_RESULT_OPTIONS;
  }, [labRepeaters]);

  // Set result
  const setResult = useCallback((sample: FlatSample, value: string) => {
    const key = `${sample.submissionId}:${sample.repeaterCode}:${sample.rowIndex}`;
    setEdits((prev) => {
      const current = prev[key] ?? sample.currentResult;
      if (current === value) {
        // Toggle off
        const next = { ...prev };
        if (sample.currentResult === value) {
          delete next[key]; // revert to original
        } else {
          next[key] = ''; // clear
        }
        return next;
      }
      return { ...prev, [key]: value };
    });
    setSaved(false);
  }, []);

  // Save all edits
  const handleSave = useCallback(async () => {
    // Group edits by submissionId
    const bySubmission: Record<string, Array<{ repeaterCode: string; rowIndex: number; value: string }>> = {};
    for (const [key, value] of Object.entries(edits)) {
      const [subId, repeaterCode, rowStr] = key.split(':');
      if (!bySubmission[subId]) bySubmission[subId] = [];
      bySubmission[subId].push({ repeaterCode, rowIndex: parseInt(rowStr), value });
    }

    for (const [subId, changes] of Object.entries(bySubmission)) {
      const sub = submissions.find((s) => s.id === subId);
      if (!sub) continue;

      const data = { ...(sub.data as Record<string, unknown>) };

      for (const change of changes) {
        const repeaterData = [...(data[change.repeaterCode] as Array<Record<string, unknown>> || [])];
        if (repeaterData[change.rowIndex]) {
          const resultField = labRepeaters.find((lr) => lr.field.code === change.repeaterCode)?.config.resultField ?? 'lab_status';
          repeaterData[change.rowIndex] = {
            ...repeaterData[change.rowIndex],
            [resultField]: change.value,
          };
        }
        data[change.repeaterCode] = repeaterData;
      }

      await updateSubmission({ id: subId, data });
    }

    setEdits({});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [edits, submissions, labRepeaters, updateSubmission]);

  // Export CSV
  const handleExport = useCallback(() => {
    const lr = labRepeaters[0];
    if (!lr) return;

    const headers = ['N°', t('csvSampleCode'), t('csvForm'), t('csvLocation'), t('csvSurveyor'),
      ...displayColumns.map((c) => i18n(c.label, locale)),
      t('result'),
    ];

    const rows = filteredSamples.map((s, i) => [
      i + 1,
      s.sampleCode,
      s.submissionCode,
      s.submissionLocation,
      s.submissionSurveyor,
      ...displayColumns.map((c) => String(s.subFields[c.code] ?? '')),
      getEffectiveResult(s),
    ]);

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-results-${campaignId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredSamples, displayColumns, labRepeaters, locale, campaignId, getEffectiveResult]);

  if (labRepeaters.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
        <FlaskConical className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          {t('noLabSection')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {t('noLabSectionHint')} <code className="bg-gray-100 px-1 rounded">labProcessing</code>
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('loadingSamples')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-orange-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('labResults')}
              </h3>
              <p className="text-xs text-gray-500">
                {totalSamples} {t('samples')} &middot;{' '}
                <span className="text-green-600">{completedCount} {t('processed')}</span> &middot;{' '}
                <span className="text-amber-600">{pendingCount} {t('pending')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 w-48 dark:bg-gray-800 dark:border-gray-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
              {(['all', 'pending', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium transition-colors',
                    statusFilter === f
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                  )}
                >
                  {f === 'all' ? t('all') : f === 'pending' ? t('pendingFilter') : t('processedFilter')}
                </button>
              ))}
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasEdits}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                saved
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : hasEdits
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600',
              )}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? t('saved') : hasEdits ? `${t('save')} (${Object.keys(edits).length})` : t('save')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredSamples.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500">
            {totalSamples === 0 ? t('noSamplesSubmitted') : t('noResultsMatchFilter')}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">N°</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('code')}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('form')}</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('location')}</th>
                  {displayColumns.map((col) => (
                    <th key={col.code} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {i18n(col.label, locale)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider bg-orange-50 dark:bg-orange-900/20">
                    {t('result')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredSamples.map((sample, idx) => {
                  const result = getEffectiveResult(sample);
                  return (
                    <tr
                      key={`${sample.submissionId}-${sample.repeaterCode}-${sample.rowIndex}`}
                      className={cn(
                        'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                        result === 'positive' && 'bg-red-50/30 dark:bg-red-900/10',
                        result === 'negative' && 'bg-green-50/30 dark:bg-green-900/10',
                      )}
                    >
                      <td className="px-3 py-2 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white text-xs">{sample.sampleCode}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{sample.submissionCode || sample.submissionId.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{sample.submissionLocation}</td>
                      {displayColumns.map((col) => {
                        const val = sample.subFields[col.code];
                        let display = String(val ?? '—');
                        // For select fields, try to resolve label
                        if (col.type === 'select' && col.options) {
                          const opt = col.options.find((o) => o.value === val);
                          if (opt) display = i18n(opt.label, locale);
                        }
                        // For checkbox
                        if (col.type === 'checkbox') {
                          display = val ? '✓' : '';
                        }
                        return (
                          <td key={col.code} className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                            {display}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 bg-orange-50/30 dark:bg-orange-900/10">
                        <div className="flex items-center justify-center gap-1">
                          {resultOptions.map((opt) => {
                            const Icon = RESULT_ICONS[opt.value] ?? HelpCircle;
                            const isActive = result === opt.value;
                            const colorClass = RESULT_COLORS[opt.value] ?? 'text-gray-600 bg-gray-50 border-gray-200';
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setResult(sample, opt.value)}
                                title={i18n(opt.label, locale)}
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all',
                                  isActive
                                    ? colorClass
                                    : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500',
                                )}
                              >
                                <Icon className="h-3 w-3" />
                                {i18n(opt.label, locale)}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
