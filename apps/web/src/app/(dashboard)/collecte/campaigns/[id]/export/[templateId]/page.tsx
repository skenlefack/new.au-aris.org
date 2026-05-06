'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet, Filter, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const s = schema as { sections?: { fields?: { code?: string; label?: { en?: string; fr?: string }; type?: string }[] }[] } | null;
  if (!s?.sections) return [];
  const rows: Field[] = [];
  for (const sec of s.sections) for (const f of sec.fields || []) if (f.code) rows.push({ code: f.code, label: f.label?.en || f.label?.fr || f.code, type: f.type || 'text' });
  return rows;
}

export default function ExportPage() {
  const { id: campaignId, templateId } = useParams<{ id: string; templateId: string }>();
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

  const handleExport = useCallback(async () => {
    setExporting(true); setError('');
    try {
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(`/api/v1/collecte/submissions?campaign=${campaignId}&limit=50000`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      let data: any[] = (json?.data || []).map((s: any) => s.data);
      if (data.length === 0) { setError('No data to export'); setExporting(false); return; }
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
    } catch (e: any) { setError(e?.message || 'Export failed'); } finally { setExporting(false); }
  }, [campaignId, format, filters, fields, name]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <Link href={`/collecte/campaigns/${campaignId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to campaign
      </Link>

      <div className="rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <Download className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-semibold">Export Data</h1>
              <p className="text-sm text-blue-100">{name || 'Loading...'}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Format */}
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Format</label>
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
              <label className="text-xs font-medium text-gray-600 uppercase flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> Filters</label>
              <div className="mt-2 space-y-2">
                {filterableFields.map((f) => (
                  <div key={f.code} className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 w-32 truncate shrink-0">{f.label}</label>
                    <input type="text" value={filters[f.code] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.code]: e.target.value }))} placeholder="Filter..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"><AlertCircle className="h-4 w-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}
          {done && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">Export complete! File downloaded.</div>}

          <button onClick={handleExport} disabled={exporting || !template} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {exporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
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
