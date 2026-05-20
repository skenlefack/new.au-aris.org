'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  AlertCircle,
  Eye,
  Table2,
  X,
  Calendar,
  User,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';

function tplName(name: unknown): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') { const o = name as Record<string, string>; return o.en ?? o.fr ?? Object.values(o)[0] ?? ''; }
  return String(name);
}

interface Field { code: string; label: string; type: string }

function extractFields(schema: unknown): Field[] {
  const s = schema as { sections?: { fields?: { code?: string; label?: { en?: string; fr?: string }; type?: string; hidden?: boolean }[] }[] } | null;
  if (!s?.sections) return [];
  const rows: Field[] = [];
  for (const sec of s.sections) {
    for (const f of sec.fields || []) {
      if (f.code && !f.hidden && !['heading', 'divider', 'spacer', 'info-box'].includes(f.type || '')) {
        rows.push({ code: f.code, label: f.label?.en || f.label?.fr || f.code, type: f.type || 'text' });
      }
    }
  }
  return rows;
}

async function fetchSubmissions(campaignId: string, limit = 100): Promise<{ submissions: any[]; total: number }> {
  const token = useAuthStore.getState().accessToken || '';
  const pageLimit = Math.min(limit, 100);
  const allSubmissions: any[] = [];
  let page = 1;
  let total = 0;
  while (true) {
    const res = await fetch(
      `/api/v1/collecte/submissions?campaign=${campaignId}&limit=${pageLimit}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const json = await res.json();
    const data = json?.data || [];
    total = json?.meta?.total ?? total;
    allSubmissions.push(...data);
    if (data.length < pageLimit || allSubmissions.length >= limit) break;
    page++;
    if (page > 100) break;
  }
  return { submissions: allSubmissions, total };
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function dl(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
}

// ── Detail slide-over panel ──
function DetailPanel({
  submission,
  fields,
  onClose,
}: {
  submission: any;
  fields: Field[];
  onClose: () => void;
}) {
  const t = useTranslations('collecte');
  const rowData = submission?.data || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('submissionDetail') || 'Submission Detail'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              ID: {submission.id?.slice(0, 8)}...
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Meta info */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
            </div>
            <span className={cn(
              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
              submission.status === 'SUBMITTED' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              submission.status === 'VALIDATED' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              submission.status === 'REJECTED' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              !['SUBMITTED', 'VALIDATED', 'REJECTED'].includes(submission.status) && 'bg-gray-100 text-gray-600',
            )}>
              {submission.status}
            </span>
          </div>
          {submission.submittedBy && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User className="h-4 w-4" />
              {submission.submittedBy?.slice(0, 8)}...
            </div>
          )}
        </div>

        {/* Field values */}
        <div className="px-6 py-4 space-y-1">
          {fields.map((field) => {
            const val = rowData[field.code];
            if (val === undefined || val === null || val === '') return null;
            return (
              <div
                key={field.code}
                className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0"
              >
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-36 shrink-0 pt-0.5 uppercase tracking-wide">
                  {field.label}
                </span>
                <span className="text-sm text-gray-900 dark:text-white break-words min-w-0">
                  {formatCellValue(val)}
                </span>
              </div>
            );
          })}
          {fields.every((f) => !rowData[f.code]) && (
            <p className="text-sm text-gray-400 py-4 text-center">{t('noData') || 'No data'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──
export default function ExportPage() {
  const { id: campaignId, templateId } = useParams<{ id: string; templateId: string }>();
  const searchParams = useSearchParams();
  const isViewMode = searchParams.get('view') === '1';
  const t = useTranslations('collecte');
  const { data: tplRes } = useFormBuilderTemplate(templateId);
  const template = tplRes?.data;
  const name = tplName(template?.name);
  const fields = useMemo(() => extractFields(template?.schema), [template?.schema]);
  const filterableFields = useMemo(() => fields.filter((f) => ['select', 'master-data-select', 'date', 'text', 'number'].includes(f.type)).slice(0, 8), [fields]);

  const [format, setFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // View mode state
  const [viewData, setViewData] = useState<any[] | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTotal, setViewTotal] = useState(0);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // Auto-load data in view mode (once)
  const [viewFetched, setViewFetched] = useState(false);
  useEffect(() => {
    if (isViewMode && !viewFetched) {
      setViewFetched(true);
      setViewLoading(true);
      fetchSubmissions(campaignId, 100)
        .then(({ submissions, total }) => {
          setViewData(submissions);
          setViewTotal(total);
        })
        .catch((e) => setError(e?.message || 'Failed to load submissions'))
        .finally(() => setViewLoading(false));
    }
  }, [isViewMode, campaignId, viewFetched]);

  const handleExport = useCallback(async () => {
    setExporting(true); setError('');
    try {
      const { submissions } = await fetchSubmissions(campaignId, 10000);
      let data: any[] = submissions.map((s: any) => s.data);
      if (data.length === 0) { setError(t('noDataToExport')); setExporting(false); return; }
      for (const [k, v] of Object.entries(filters)) { if (v) data = data.filter((d) => String(d?.[k] ?? '').toLowerCase().includes(v.toLowerCase())); }

      if (format === 'json') {
        dl(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${name}_export.json`);
      } else if (format === 'csv') {
        const hdr = fields.map((f) => f.code);
        const csv = [hdr.join(','), ...data.map((r) => hdr.map((h) => `"${String(r?.[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
        dl(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `${name}_export.csv`);
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Data');
        const hr = ws.addRow(fields.map((f) => f.label));
        hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; });
        for (const row of data) ws.addRow(fields.map((f) => row?.[f.code] ?? ''));
        ws.columns.forEach((col, i) => { col.width = Math.max(12, (fields[i]?.label.length ?? 10) + 4); });
        const buf = await wb.xlsx.writeBuffer();
        dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}_export.xlsx`);
      }
      setDone(true);
    } catch (e: any) { setError(e?.message || t('exportFailed')); } finally { setExporting(false); }
  }, [campaignId, format, filters, fields, name]);

  // Show max 4 summary columns (compact, no horizontal scroll)
  const summaryFields = useMemo(() => fields.slice(0, 4), [fields]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── VIEW MODE ── */}
      {isViewMode && (
        <>
          {/* Header bar — light green gradient matching site style */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Table2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">{name || t('loading')}</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {viewTotal} {t('submissions') || 'submission(s)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/collecte/campaigns/${campaignId}/export/${templateId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('export')}
                </Link>
                <Link
                  href={`/collecte/campaigns/${campaignId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t('backToCampaign')}
                </Link>
              </div>
            </div>
          </div>

          {/* Data table */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            {viewLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}

            {error && (
              <div className="m-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {viewData && viewData.length === 0 && !viewLoading && (
              <div className="text-center py-16">
                <Table2 className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">{t('noSubmissionsYet') || 'No submissions yet for this campaign.'}</p>
              </div>
            )}

            {viewData && viewData.length > 0 && (
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-10">
                        <Hash className="h-3.5 w-3.5" />
                      </th>
                      {summaryFields.map((f) => (
                        <th key={f.code} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">{t('status') || 'Status'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-28">{t('date') || 'Date'}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {viewData.map((sub, idx) => {
                      const rowData = sub.data || {};
                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedSub(sub)}
                        >
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{idx + 1}</td>
                          {summaryFields.map((f) => (
                            <td key={f.code} className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm truncate max-w-[200px]">
                              {formatCellValue(rowData[f.code])}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              sub.status === 'SUBMITTED' && 'bg-blue-100 text-blue-700',
                              sub.status === 'VALIDATED' && 'bg-green-100 text-green-700',
                              sub.status === 'REJECTED' && 'bg-red-100 text-red-700',
                              !['SUBMITTED', 'VALIDATED', 'REJECTED'].includes(sub.status) && 'bg-gray-100 text-gray-600',
                            )}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedSub(sub); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {viewTotal > viewData.length && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 text-center">
                    <p className="text-xs text-gray-400">
                      Showing {viewData.length} of {viewTotal} submissions
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Slide-over detail panel */}
          {selectedSub && (
            <DetailPanel
              submission={selectedSub}
              fields={fields}
              onClose={() => setSelectedSub(null)}
            />
          )}
        </>
      )}

      {/* ── EXPORT MODE ── */}
      {!isViewMode && (
        <div className="space-y-6">
          <Link href={`/collecte/campaigns/${campaignId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> {t('backToCampaign')}
          </Link>

          <div className="rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center gap-3 text-white">
                <Download className="h-6 w-6" />
                <div>
                  <h1 className="text-lg font-semibold">{t('exportData')}</h1>
                  <p className="text-sm text-blue-100">{name || t('loading')}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase">{t('format')}</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {(['xlsx', 'csv', 'json'] as const).map((f) => (
                    <button key={f} onClick={() => setFormat(f)} className={cn('flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all', format === f ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                      <FileSpreadsheet className="h-6 w-6" />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {filterableFields.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> {t('filters')}</label>
                  <div className="mt-2 space-y-2">
                    {filterableFields.map((f) => (
                      <div key={f.code} className="flex items-center gap-3">
                        <label className="text-xs text-gray-500 w-32 truncate shrink-0">{f.label}</label>
                        <input type="text" value={filters[f.code] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.code]: e.target.value }))} placeholder={t('filterByField').replace('{field}', f.label)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"><AlertCircle className="h-4 w-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}
              {done && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">{t('exportComplete')}</div>}

              <button onClick={handleExport} disabled={exporting || !template} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                {exporting ? t('exporting') : t('exportFormat').replace('{format}', format.toUpperCase())}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
