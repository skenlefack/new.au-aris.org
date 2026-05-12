'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Upload, FileSpreadsheet, FileDown, Loader2, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';

function tplName(name: unknown): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') { const o = name as Record<string, string>; return o.en ?? o.fr ?? Object.values(o)[0] ?? ''; }
  return String(name);
}

interface Field { code: string; label: string; type: string }

function extractFields(schema: unknown): Field[] {
  const s = schema as { sections?: { fields?: { code?: string; label?: { en?: string; fr?: string }; type?: string }[] }[] } | null;
  if (!s?.sections) return [];
  const rows: Field[] = [];
  for (const sec of s.sections) for (const f of sec.fields || []) if (f.code) rows.push({ code: f.code, label: f.label?.en || f.label?.fr || f.code, type: f.type || 'text' });
  return rows;
}

export default function ImportPage() {
  const { id: campaignId, templateId } = useParams<{ id: string; templateId: string }>();
  const t = useTranslations('collecte');
  const { data: tplRes } = useFormBuilderTemplate(templateId);
  const template = tplRes?.data;
  const name = tplName(template?.name);
  const fields = useMemo(() => extractFields(template?.schema), [template?.schema]);

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const handleGenTemplate = useCallback(async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Entry', { views: [{ state: 'frozen', ySplit: 1 }] });
    const hr = ws.addRow(fields.map((f) => f.code));
    hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; });
    ws.addRow(fields.map((f) => f.label));
    for (let i = 0; i < 50; i++) ws.addRow([]);
    ws.columns.forEach((col, i) => { col.width = Math.max(14, (fields[i]?.label.length ?? 10) + 4); });
    const buf = await wb.xlsx.writeBuffer();
    dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `ARIS_Template_${name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }, [fields, name]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true); setError(''); setResult(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) { setError(t('fileEmpty')); setImporting(false); return; }
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? '').trim(); });
      const startRow = fields.some((f) => f.label === String(ws.getRow(2).getCell(1).value ?? '')) ? 3 : 2;
      const rows: Record<string, unknown>[] = [];
      for (let r = startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r); const d: Record<string, unknown> = {}; let has = false;
        headers.forEach((h, i) => { if (!h) return; const v = row.getCell(i + 1).value; if (v != null && v !== '') { d[h] = v; has = true; } });
        if (has) rows.push(d);
      }
      if (rows.length === 0) { setError(t('noDataRowsFound')); setImporting(false); return; }
      const token = localStorage.getItem('accessToken') || '';
      let success = 0, errors = 0;
      for (let i = 0; i < rows.length; i += 20) {
        await Promise.all(rows.slice(i, i + 20).map((data) =>
          fetch('/api/v1/collecte/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ campaignId, data }) })
            .then((r) => { if (r.ok) success++; else errors++; }).catch(() => { errors++; })
        ));
      }
      setResult({ success, errors, total: rows.length });
    } catch (e: any) { setError(e?.message || t('importFailed')); } finally { setImporting(false); }
  }, [file, campaignId, fields]);

  return (
    <div className="space-y-6 pb-12">
      <Link href={`/collecte/campaigns/${campaignId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('backToCampaign')}
      </Link>

      <div className="rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center gap-3 text-white">
            <Upload className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-semibold">{t('importData')}</h1>
              <p className="text-sm text-emerald-100">{name || t('loading')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Generate template */}
          <button onClick={handleGenTemplate} disabled={!template} className="w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-5 hover:bg-emerald-100 transition-colors text-left">
            <FileDown className="h-10 w-10 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-700">{t('downloadRefTemplate')}</p>
              <p className="text-xs text-emerald-600/70 mt-0.5">{t('fieldsReadyForEntry').replace('{count}', String(fields.length))}</p>
            </div>
          </button>

          {/* File upload */}
          <div className={cn('rounded-xl border-2 border-dashed p-8 text-center transition-colors', file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400')}>
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-12 w-12 text-green-500" />
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <button onClick={() => { setFile(null); setResult(null); }} className="text-xs text-red-500 hover:text-red-600 mt-1">{t('remove')}</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-12 w-12 text-gray-400" />
                <p className="text-sm text-gray-600">{t('selectExcelFile')}</p>
                <label className="cursor-pointer rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
                  {t('browseFiles')}
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); setError(''); } }} className="hidden" />
                </label>
                <p className="text-[11px] text-gray-400">.xlsx, .xls, .csv</p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 mb-3"><Check className="h-5 w-5 text-green-600" /><span className="font-semibold text-gray-900">{t('importComplete')}</span></div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-2xl font-bold">{result.total}</p><p className="text-xs text-gray-500 uppercase mt-0.5">{t('totalRows')}</p></div>
                <div><p className="text-2xl font-bold text-green-600">{result.success}</p><p className="text-xs text-gray-500 uppercase mt-0.5">{t('success')}</p></div>
                <div><p className="text-2xl font-bold text-red-600">{result.errors}</p><p className="text-xs text-gray-500 uppercase mt-0.5">{t('errors')}</p></div>
              </div>
            </div>
          )}

          {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"><AlertCircle className="h-4 w-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}

          {!result && (
            <button onClick={handleImport} disabled={!file || importing} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {importing ? t('importing') : t('importData')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function dl(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
}
