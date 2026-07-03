'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, FileSpreadsheet, FileDown, Loader2, AlertCircle,
  Check, CheckCircle2, XCircle, Pencil, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import { resolveTemplateName } from '@/lib/utils/template-names';
import {
  type FieldDef, type ResolvedRow,
  resolveRow, buildSubmissionData,
} from '@/lib/utils/import-resolver';

// ── Helpers ──

function ml(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const o = val as Record<string, string>;
    return o.en ?? o.fr ?? Object.values(o)[0] ?? '';
  }
  return String(val);
}

function extractFields(schema: unknown): FieldDef[] {
  const s = schema as {
    sections?: {
      order?: number;
      fields?: {
        code?: string;
        label?: Record<string, string>;
        type?: string;
        required?: boolean;
        hidden?: boolean;
        properties?: any;
      }[];
    }[];
  } | null;
  if (!s?.sections) return [];
  const rows: FieldDef[] = [];
  const sorted = [...(s.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const sec of sorted) {
    for (const f of sec.fields || []) {
      if (!f.code) continue;
      if (['heading', 'divider', 'spacer', 'info-box', 'geo-selector'].includes(f.type ?? '')) continue;
      rows.push({
        code: f.code,
        label: ml(f.label) || f.code,
        type: f.type || 'text',
        required: f.required ?? false,
        properties: f.properties,
      });
    }
  }
  return rows;
}

/** Format a resolved cell value for display */
function formatCellValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') {
    // admin_location: {level_0: "MG", level_1: uuid, ...}
    if (fieldType === 'admin-location') {
      const loc = value as Record<string, string>;
      const parts: string[] = [];
      if (loc.level_0) parts.push(loc.level_0);
      if (loc.level_1) parts.push(loc.level_1.startsWith('__new:') ? loc.level_1.slice(6) : loc.level_1.slice(0, 8) + '...');
      if (loc.level_2) parts.push(loc.level_2.startsWith('__new:') ? loc.level_2.slice(6) : loc.level_2.slice(0, 8) + '...');
      return parts.join(' > ') || '—';
    }
    // Generic object
    return JSON.stringify(value);
  }
  return String(value);
}

/** Inline editor — renders a select for ref fields, text input for others */
function CellEditor({ field, value, onSave, onCancel }: {
  field: FieldDef;
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Load options for select/master-data-select fields
  useEffect(() => {
    if (field.type === 'select' && field.properties?.options) {
      const opts = (field.properties.options as any[]).map((o) => ({
        value: o.value,
        label: typeof o.label === 'object' ? (o.label.en ?? o.label.fr ?? o.value) : String(o.label),
      }));
      setOptions(opts);
    } else if (field.type === 'master-data-select' && field.properties?.masterDataType) {
      setLoading(true);
      const mdType = field.properties.masterDataType;
      const url = mdType === 'fish-species'
        ? `/api/v1/master-data/ref/fish-species/for-select?search=${encodeURIComponent(value)}`
        : `/api/v1/master-data/ref/${mdType}/for-select`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const raw = localStorage.getItem('aris-auth');
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.state?.accessToken) headers['Authorization'] = `Bearer ${p.state.accessToken}`;
          if (p?.state?.user?.tenantId) headers['X-Tenant-Id'] = p.state.user.tenantId;
        }
      } catch {}
      fetch(url, { headers })
        .then((r) => r.json())
        .then((data) => {
          const items = (data.data ?? []).map((item: any) => ({
            value: item.id ?? item.code,
            label: typeof item.name === 'object'
              ? (item.name.en ?? item.name.fr ?? item.code ?? '')
              : String(item.name ?? item.code ?? ''),
          }));
          setOptions(items);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [field, value]);

  // Select-type fields
  if (field.type === 'select' || field.type === 'master-data-select') {
    const filtered = search
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : options;

    return (
      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none dark:bg-gray-900"
        />
        <div className="max-h-32 overflow-y-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          {loading ? (
            <p className="px-2 py-1 text-xs text-gray-400">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400">No results</p>
          ) : (
            filtered.slice(0, 20).map((o) => (
              <button
                key={o.value}
                onClick={() => onSave(o.value)}
                className="block w-full px-2 py-1 text-left text-xs text-gray-700 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-blue-900/20 truncate"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
        <button onClick={onCancel} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    );
  }

  // Text/number/date fields
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(val);
          if (e.key === 'Escape') onCancel();
        }}
        className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-900"
      />
      <button onClick={() => onSave(val)} className="text-blue-600"><Check className="h-3 w-3" /></button>
    </div>
  );
}

function dl(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  URL.revokeObjectURL(u);
}

// ── Types ──

type Phase = 'upload' | 'resolving' | 'preview' | 'importing' | 'done';

// ── Page Component ──

export default function ImportPage() {
  const { id: campaignId, templateId } = useParams<{ id: string; templateId: string }>();
  const router = useRouter();
  const t = useTranslations('collecte');
  const locale = useLocaleStore((s) => s.locale);

  const { data: tplRes } = useFormBuilderTemplate(templateId);
  const template = tplRes?.data;
  const name = resolveTemplateName(ml(template?.name), locale);
  const fields = useMemo(() => extractFields(template?.schema), [template?.schema]);

  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ResolvedRow[]>([]);
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; code: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const validRows = useMemo(() => rows.filter((r) => r.status === 'valid'), [rows]);
  const errorRows = useMemo(() => rows.filter((r) => r.status === 'error'), [rows]);

  // ── Template Generation ──
  const handleGenTemplate = useCallback(async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Entry', { views: [{ state: 'frozen', ySplit: 2 }] });

    // Row 1: field codes (hidden-ish, used for mapping)
    const hr = ws.addRow(fields.map((f) => f.code));
    hr.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    });

    // Row 2: human labels
    const lr = ws.addRow(fields.map((f) => `${f.label}${f.required ? ' *' : ''}`));
    lr.eachCell((c) => {
      c.font = { bold: true, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    });

    for (let i = 0; i < 100; i++) ws.addRow([]);
    ws.columns.forEach((col, i) => {
      col.width = Math.max(16, (fields[i]?.label.length ?? 10) + 6);
    });

    // Instructions sheet
    const inst = wb.addWorksheet('Instructions');
    inst.addRow(['Field Code', 'Label', 'Type', 'Required', 'Notes']);
    for (const f of fields) {
      const notes = f.type === 'admin-location' ? 'Format: Country, Admin1, Admin2 (e.g., Madagascar, Antananarivo, Atsimondrano)'
        : f.type === 'master-data-select' ? `Search by name or code (type: ${f.properties?.masterDataType ?? ''})`
        : f.type === 'select' ? `Options: ${(f.properties?.options ?? []).map((o: any) => ml(o.label) || o.value).join(', ')}`
        : f.type === 'date' ? 'Format: YYYY-MM-DD or DD/MM/YYYY'
        : f.type === 'number' ? 'Numeric value'
        : '';
      inst.addRow([f.code, f.label, f.type, f.required ? 'Yes' : 'No', notes]);
    }
    inst.columns.forEach((col) => { col.width = 30; });

    const buf = await wb.xlsx.writeBuffer();
    dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `ARIS_Template_${name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }, [fields, name]);

  // ── Excel Parsing + Resolution ──
  const handleParse = useCallback(async () => {
    if (!file || fields.length === 0) return;
    setPhase('resolving');
    setError('');

    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) {
        setError('File is empty or has no data rows');
        setPhase('upload');
        return;
      }

      // Row 1: headers (field codes)
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, col) => {
        headers[col - 1] = String(cell.value ?? '').trim();
      });

      // Skip row 2 if it's labels
      const row2Val = String(ws.getRow(2).getCell(1).value ?? '');
      const isLabel = fields.some((f) => f.label === row2Val);
      const startRow = isLabel ? 3 : 2;

      // Parse raw data
      const rawRows: Record<string, unknown>[] = [];
      for (let r = startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const d: Record<string, unknown> = {};
        let hasValue = false;
        headers.forEach((h, i) => {
          if (!h) return;
          const v = row.getCell(i + 1).value;
          if (v !== null && v !== undefined && v !== '') {
            d[h] = v;
            hasValue = true;
          }
        });
        if (hasValue) rawRows.push(d);
      }

      if (rawRows.length === 0) {
        setError('No data rows found in the file');
        setPhase('upload');
        return;
      }

      // Resolve each row
      setResolveProgress({ current: 0, total: rawRows.length });
      const resolved: ResolvedRow[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = await resolveRow(i + 1, rawRows[i], fields);
        resolved.push(row);
        setResolveProgress({ current: i + 1, total: rawRows.length });
      }

      setRows(resolved);
      setPhase('preview');
    } catch (err: any) {
      setError(err?.message || 'Failed to parse Excel file');
      setPhase('upload');
    }
  }, [file, fields]);

  // Auto-parse when file is selected
  useEffect(() => {
    if (file && phase === 'upload') handleParse();
  }, [file, phase, handleParse]);

  // ── Re-resolve a single cell after edit ──
  const handleCellEdit = useCallback(async (rowIdx: number, code: string, newValue: string) => {
    const field = fields.find((f) => f.code === code);
    if (!field) return;

    const row = rows[rowIdx];
    if (!row) return;

    // Re-resolve just this field
    const fakeRow: Record<string, unknown> = {};
    for (const [c, cell] of Object.entries(row.cells)) {
      fakeRow[c] = c === code ? newValue : cell.raw;
    }
    const reResolved = await resolveRow(row.index, fakeRow, fields);

    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = reResolved;
      return next;
    });
    setEditingCell(null);
  }, [fields, rows]);

  // ── Import ──
  const handleImport = useCallback(async (onlyValid: boolean) => {
    const toImport = onlyValid ? validRows : rows;
    if (toImport.length === 0) return;

    setPhase('importing');
    let token = '';
    let tenantId = '';
    try {
      const raw = localStorage.getItem('aris-auth');
      if (raw) {
        const p = JSON.parse(raw);
        token = p?.state?.accessToken || '';
        tenantId = p?.state?.user?.tenantId || '';
      }
    } catch { /* ignore */ }

    let success = 0;
    let errors = 0;

    for (let i = 0; i < toImport.length; i += 5) {
      const batch = toImport.slice(i, i + 5);
      await Promise.all(batch.map(async (row) => {
        const data = buildSubmissionData(row);
        try {
          const res = await fetch('/api/v1/collecte/submissions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
            },
            body: JSON.stringify({
              campaignId,
              formTemplateId: templateId,
              data,
              status: 'SUBMITTED',
            }),
          });
          if (res.ok) success++;
          else errors++;
        } catch {
          errors++;
        }
      }));
    }

    setImportResult({ success, errors, total: toImport.length });
    setPhase('done');
  }, [validRows, rows, campaignId, templateId]);

  // ── Render ──

  if (!template) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/collecte/campaigns/${campaignId}`} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Import — {name}</h1>
          <p className="text-sm text-gray-500">{fields.length} fields</p>
        </div>
      </div>

      {/* Phase: Upload */}
      {phase === 'upload' && (
        <div className="space-y-4">
          {/* Template download */}
          <button onClick={handleGenTemplate} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <FileDown className="h-4 w-4" /> Download Excel Template
          </button>

          {/* File upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 dark:border-gray-700 dark:bg-gray-900/50"
          >
            <Upload className="h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
              Drag & drop your Excel file here
            </p>
            <p className="mt-1 text-xs text-gray-400">or</p>
            <label className="mt-2 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Browse files
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>
      )}

      {/* Phase: Resolving */}
      {phase === 'resolving' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            Resolving data... {resolveProgress.current} / {resolveProgress.total}
          </p>
          <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${resolveProgress.total > 0 ? (resolveProgress.current / resolveProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase: Preview */}
      {phase === 'preview' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">{validRows.length} valid</span>
              </div>
              {errorRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{errorRows.length} with errors</span>
                </div>
              )}
              <span className="text-xs text-gray-400">{rows.length} total rows</span>
            </div>
            <div className="flex items-center gap-2">
              {validRows.length > 0 && (
                <button
                  onClick={() => handleImport(true)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Check className="mr-1.5 inline h-4 w-4" />
                  Import Valid ({validRows.length})
                </button>
              )}
              {errorRows.length > 0 && validRows.length > 0 && (
                <button
                  onClick={() => handleImport(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  Import All ({rows.length})
                </button>
              )}
              <button
                onClick={() => { setPhase('upload'); setFile(null); setRows([]); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-10">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-20">Status</th>
                  {fields.slice(0, 8).map((f) => (
                    <th key={f.code} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 max-w-[180px]">
                      {f.label}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
                    </th>
                  ))}
                  {fields.length > 8 && <th className="px-3 py-2 text-gray-400">+{fields.length - 8}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row, rowIdx) => (
                  <React.Fragment key={rowIdx}>
                    <tr
                      className={cn(
                        'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer',
                        row.status === 'error' && 'bg-red-50/50 dark:bg-red-900/10',
                      )}
                      onClick={() => setExpandedRow(expandedRow === rowIdx ? null : rowIdx)}
                    >
                      <td className="px-3 py-2 text-xs text-gray-400">{row.index}</td>
                      <td className="px-3 py-2">
                        {row.status === 'valid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3 w-3" /> {row.errorCount}
                          </span>
                        )}
                      </td>
                      {fields.slice(0, 8).map((f) => {
                        const cell = row.cells[f.code];
                        if (!cell) return <td key={f.code} className="px-3 py-2 text-gray-300">—</td>;
                        return (
                          <td key={f.code} className="px-3 py-2 max-w-[180px]">
                            {editingCell?.rowIdx === rowIdx && editingCell?.code === f.code ? (
                              <CellEditor
                                field={f}
                                value={String(cell.raw ?? '')}
                                onSave={(v) => handleCellEdit(rowIdx, f.code, v)}
                                onCancel={() => setEditingCell(null)}
                              />
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className={cn(
                                  'truncate text-xs',
                                  cell.status === 'ok' ? 'text-gray-700 dark:text-gray-300' :
                                  cell.status === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                                  'text-red-600 dark:text-red-400',
                                )}>
                                  {cell.status === 'error' ? formatCellValue(cell.raw, f.type) : formatCellValue(cell.resolved ?? cell.raw, f.type)}
                                </span>
                                {cell.status === 'error' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingCell({ rowIdx, code: f.code }); }}
                                    className="shrink-0 text-blue-500 hover:text-blue-700"
                                    title="Edit"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {fields.length > 8 && (
                        <td className="px-3 py-2">
                          {expandedRow === rowIdx ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </td>
                      )}
                    </tr>
                    {/* Expanded row details */}
                    {expandedRow === rowIdx && (
                      <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                        <td colSpan={10 + (fields.length > 8 ? 1 : 0)} className="px-6 py-3">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {fields.map((f) => {
                              const cell = row.cells[f.code];
                              return (
                                <div key={f.code} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-medium text-gray-400">{f.label}</p>
                                    <p className={cn('text-xs truncate', cell?.status === 'error' ? 'text-red-600' : 'text-gray-700 dark:text-gray-300')}>
                                      {cell ? (cell.status === 'error' ? String(cell.raw ?? '—') : String(cell.resolved ?? cell.raw ?? '—')) : '—'}
                                    </p>
                                    {cell?.message && <p className="text-[10px] text-amber-600 mt-0.5">{cell.message}</p>}
                                  </div>
                                  {cell?.status === 'error' && (
                                    <button
                                      onClick={() => { setEditingCell({ rowIdx, code: f.code }); }}
                                      className="shrink-0 rounded p-1 text-blue-500 hover:bg-blue-50"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  {cell?.status === 'ok' && <Check className="h-3.5 w-3.5 shrink-0 text-green-500 mt-1" />}
                                  {cell?.status === 'warning' && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-1" />}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phase: Importing */}
      {phase === 'importing' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-medium text-gray-600">Importing submissions...</p>
        </div>
      )}

      {/* Phase: Done */}
      {phase === 'done' && importResult && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className={cn('flex h-16 w-16 items-center justify-center rounded-full', importResult.errors === 0 ? 'bg-green-100' : 'bg-amber-100')}>
            {importResult.errors === 0 ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-600" />
            )}
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Import Complete</h2>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-sm text-green-600 font-semibold">{importResult.success} imported</span>
            {importResult.errors > 0 && (
              <span className="text-sm text-red-600 font-semibold">{importResult.errors} failed</span>
            )}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Link href={`/collecte/campaigns/${campaignId}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Back to Campaign
            </Link>
            <button
              onClick={() => { setPhase('upload'); setFile(null); setRows([]); setImportResult(null); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
