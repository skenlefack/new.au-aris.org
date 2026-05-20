'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet, Filter, Loader2, AlertCircle, Eye, Table2 } from 'lucide-react';
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
  const pageLimit = Math.min(limit, 100); // Backend max is 100
  const allSubmissions: any[] = [];
  let page = 1;
  let total = 0;

  // Fetch pages until we have enough or no more data
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
    if (page > 100) break; // Safety cap
  }

  return { submissions: allSubmissions, total };
}

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

  // Visible columns (max 8 for readability)
  const visibleFields = useMemo(() => fields.slice(0, 8), [fields]);

  return (
    <div className="space-y-6 pb-12">
      <Link href={`/collecte/campaigns/${campaignId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('backToCampaign')}
      </Link>

      {/* ── VIEW MODE: Data Table ── */}
      {isViewMode && (
        <div className="rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-gray-700 to-gray-900">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <Table2 className="h-6 w-6" />
                <div>
                  <h1 className="text-lg font-semibold">{t('submittedData') || 'Submitted Data'}</h1>
                  <p className="text-sm text-gray-300">{name || t('loading')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">
                  {viewTotal} {t('submissions') || 'submission(s)'}
                </span>
                <Link
                  href={`/collecte/campaigns/${campaignId}/export/${templateId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('export')}
                </Link>
              </div>
            </div>
          </div>

          <div className="p-6">
            {viewLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {viewData && viewData.length === 0 && (
              <div className="text-center py-12">
                <Table2 className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">{t('noSubmissionsYet') || 'No submissions yet for this campaign.'}</p>
              </div>
            )}

            {viewData && viewData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                      {visibleFields.map((f) => (
                        <th key={f.code} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase truncate max-w-[160px]">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('status') || 'Status'}</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('submittedAt') || 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {viewData.map((sub, idx) => {
                      const rowData = sub.data || {};
                      return (
                        <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                          {visibleFields.map((f) => (
                            <td key={f.code} className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[160px]" title={String(rowData[f.code] ?? '')}>
                              {formatCellValue(rowData[f.code])}
                            </td>
                          ))}
                          <td className="px-3 py-2">
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
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {viewTotal > viewData.length && (
                  <p className="mt-3 text-xs text-gray-400 text-center">
                    Showing {viewData.length} of {viewTotal} submissions
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPORT MODE ── */}
      {!isViewMode && (
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
            {/* Format */}
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

            {/* Filters */}
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
      )}
    </div>
  );
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
