'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Filter,
  Check,
  Loader2,
  AlertCircle,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import type { FormTemplateListItem } from '@/lib/api/form-builder-hooks';

// ── Types ──

interface SchemaSection {
  name?: { en?: string; fr?: string };
  order?: number;
  fields?: SchemaField[];
}

interface SchemaField {
  code?: string;
  type?: string;
  label?: { en?: string; fr?: string };
  required?: boolean;
  properties?: Record<string, unknown>;
}

interface SelectOpt {
  label?: { en?: string; fr?: string };
  value?: string;
}

function ml(t?: { en?: string; fr?: string }): string {
  return t?.en || t?.fr || '';
}

/** Safely extract a display string from a template name (may be string or i18n object) */
function tplName(name: unknown): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (typeof name === 'object' && name !== null) {
    const obj = name as Record<string, string>;
    return obj.en ?? obj.fr ?? obj.pt ?? Object.values(obj).find((v) => typeof v === 'string') ?? '';
  }
  return String(name);
}

function flattenFields(sections: SchemaSection[]): { code: string; label: string; type: string }[] {
  const rows: { code: string; label: string; type: string }[] = [];
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const sec of sorted) {
    for (const f of sec.fields || []) {
      if (f.code) rows.push({ code: f.code, label: ml(f.label) || f.code, type: f.type || 'text' });
    }
  }
  return rows;
}

// ── Export Modal ──

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  template: FormTemplateListItem;
}

export function ExportModal({ open, onClose, campaignId, template }: ExportModalProps) {
  const t = useTranslations('collecte');
  const { locale } = useLocaleStore();
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const schema = template.schema as { sections?: SchemaSection[] } | undefined;
  const fields = useMemo(() => flattenFields(schema?.sections || []), [schema]);

  // Fields that are filterable (select, date, text)
  const filterableFields = useMemo(
    () => fields.filter((f) => ['select', 'master-data-select', 'date', 'text', 'number'].includes(f.type)),
    [fields],
  );

  const handleFilterChange = (code: string, value: string) => {
    setFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[code];
        return next;
      }
      return { ...prev, [code]: value };
    });
  };

  const activeFilterCount = Object.keys(filters).filter((k) => filters[k]).length;

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError('');
    try {
      // Build query params
      const params = new URLSearchParams();
      params.set('campaign', campaignId);
      params.set('limit', '100000'); // Large limit for export
      params.set('format', format);
      // Add filters
      for (const [key, val] of Object.entries(filters)) {
        if (val) params.set(`filter_${key}`, val);
      }

      const token = document.cookie
        .split('; ')
        .find((c) => c.startsWith('token='))
        ?.split('=')[1] || localStorage.getItem('accessToken') || '';

      const res = await fetch(`/api/v1/collecte/submissions/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // Fallback: fetch all submissions and export client-side
        const dataRes = await fetch(`/api/v1/collecte/submissions?campaign=${campaignId}&limit=50000`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await dataRes.json();
        const submissions = json?.data || [];

        if (submissions.length === 0) {
          setError('No data to export');
          setExporting(false);
          return;
        }

        // Apply client-side filters
        let filtered = submissions;
        for (const [key, val] of Object.entries(filters)) {
          if (val) {
            filtered = filtered.filter((s: any) => {
              const fieldVal = String(s.data?.[key] ?? '').toLowerCase();
              return fieldVal.includes(val.toLowerCase());
            });
          }
        }

        if (format === 'json') {
          const blob = new Blob([JSON.stringify(filtered.map((s: any) => s.data), null, 2)], { type: 'application/json' });
          downloadBlob(blob, `${tplName(template.name)}_export.json`);
        } else if (format === 'csv') {
          const headers = fields.map((f) => f.code);
          const rows = filtered.map((s: any) => headers.map((h) => String(s.data?.[h] ?? '')));
          const csv = [headers.join(','), ...rows.map((r: string[]) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n');
          downloadBlob(new Blob([csv], { type: 'text/csv' }), `${tplName(template.name)}_export.csv`);
        } else {
          // XLSX export
          const ExcelJS = (await import('exceljs')).default;
          const wb = new ExcelJS.Workbook();
          wb.creator = 'ARIS 4.0 — AU-IBAR';
          const ws = wb.addWorksheet('Data');

          // Header row
          const headerRow = ws.addRow(fields.map((f) => f.label));
          headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
            cell.alignment = { horizontal: 'center' };
          });

          // Data rows
          for (const sub of filtered) {
            ws.addRow(fields.map((f) => sub.data?.[f.code] ?? ''));
          }

          // Auto-width columns
          ws.columns.forEach((col, i) => {
            col.width = Math.max(12, (fields[i]?.label.length ?? 10) + 4);
          });

          const buffer = await wb.xlsx.writeBuffer();
          downloadBlob(
            new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            `${tplName(template.name)}_export.xlsx`,
          );
        }
      } else {
        // Server-side export returned a file
        const blob = await res.blob();
        const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'xlsx';
        downloadBlob(blob, `${tplName(template.name)}_export.${ext}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [campaignId, format, filters, fields, tplName(template.name)]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <Download className="h-5 w-5" />
            <div>
              <h2 className="text-base font-semibold">Export Data</h2>
              <p className="text-xs text-blue-100">{tplName(template.name)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Format selection */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Format</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['xlsx', 'csv', 'json'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-medium transition-all',
                    format === f
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600',
                  )}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filters {activeFilterCount > 0 && <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 text-[10px] dark:bg-blue-900/30 dark:text-blue-300">{activeFilterCount}</span>}
              </label>
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters({})} className="text-[10px] text-red-500 hover:text-red-600">
                  Clear all
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
              {filterableFields.slice(0, 8).map((f) => (
                <div key={f.code} className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400 w-28 truncate shrink-0" title={f.label}>
                    {f.label}
                  </label>
                  <input
                    type="text"
                    placeholder={`Filter by ${f.label}...`}
                    value={filters[f.code] || ''}
                    onChange={(e) => handleFilterChange(f.code, e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
              ))}
              {filterableFields.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">No filterable fields available</p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  template: FormTemplateListItem;
}

export function ImportModal({ open, onClose, campaignId, template }: ImportModalProps) {
  const t = useTranslations('collecte');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const schema = template.schema as { sections?: SchemaSection[] } | undefined;
  const fields = useMemo(() => flattenFields(schema?.sections || []), [schema]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))) {
      setFile(f);
      setResult(null);
      setError('');
    } else {
      setError('Please upload an Excel (.xlsx) or CSV file');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
    }
  }, []);

  const handleGenerateTemplate = useCallback(async () => {
    // Generate a reference Excel template with form fields as headers
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ARIS 4.0 — AU-IBAR';

    // Data Entry sheet
    const ws = wb.addWorksheet('Data Entry', {
      properties: { defaultColWidth: 18 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Header row with field codes
    const headerRow = ws.addRow(fields.map((f) => f.code));
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });

    // Label row (row 2) for human reference
    const labelRow = ws.addRow(fields.map((f) => f.label));
    labelRow.eachCell((cell) => {
      cell.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    });

    // 50 empty rows for data entry
    for (let i = 0; i < 50; i++) {
      ws.addRow(fields.map(() => ''));
    }

    // Auto-width
    ws.columns.forEach((col, i) => {
      col.width = Math.max(14, (fields[i]?.label.length ?? 10) + 4);
    });

    // Instructions sheet
    const wsInst = wb.addWorksheet('Instructions');
    wsInst.addRow(['ARIS 4.0 — Import Template']);
    wsInst.addRow([`Form: ${tplName(template.name)}`]);
    wsInst.addRow([`Version: ${template.version}`]);
    wsInst.addRow([`Fields: ${fields.length}`]);
    wsInst.addRow(['']);
    wsInst.addRow(['Instructions:']);
    wsInst.addRow(['1. Fill data starting from row 3 in the Data Entry sheet']);
    wsInst.addRow(['2. Row 1 contains field CODES (do not modify)']);
    wsInst.addRow(['3. Row 2 contains human-readable labels (for reference only)']);
    wsInst.addRow(['4. Each row after row 2 = one submission']);
    wsInst.addRow(['5. Required fields must be filled for successful import']);
    wsInst.addRow(['']);
    wsInst.addRow(['Field Reference:']);
    for (const f of fields) {
      wsInst.addRow([`  ${f.code} — ${f.label} (${f.type})`]);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `ARIS_Import_Template_${tplName(template.name).replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }, [fields, tplName(template.name), template.version]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    setResult(null);

    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await wb.xlsx.load(buffer);

      // Read first sheet
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) {
        setError('File is empty or has no data rows');
        setImporting(false);
        return;
      }

      // Row 1 = field codes (headers)
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim();
      });

      // Skip row 2 if it looks like labels (check if first cell matches a field label)
      const row2Val = String(ws.getRow(2).getCell(1).value ?? '');
      const startRow = fields.some((f) => f.label === row2Val) ? 3 : 2;

      // Parse data rows
      const rows: Record<string, unknown>[] = [];
      for (let r = startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        if (!row || row.cellCount === 0) continue;

        const rowData: Record<string, unknown> = {};
        let hasValue = false;
        headers.forEach((header, idx) => {
          if (!header) return;
          const cell = row.getCell(idx + 1);
          const val = cell.value;
          if (val !== null && val !== undefined && val !== '') {
            rowData[header] = val;
            hasValue = true;
          }
        });
        if (hasValue) rows.push(rowData);
      }

      if (rows.length === 0) {
        setError('No data rows found in file');
        setImporting(false);
        return;
      }

      // Submit rows as form submissions
      const token = document.cookie
        .split('; ')
        .find((c) => c.startsWith('token='))
        ?.split('=')[1] || localStorage.getItem('accessToken') || '';

      let success = 0;
      let errors = 0;
      const BATCH_SIZE = 20;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const promises = batch.map((rowData) =>
          fetch('/api/v1/collecte/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ campaignId, data: rowData }),
          }).then((r) => {
            if (r.ok) success++;
            else errors++;
          }).catch(() => { errors++; }),
        );
        await Promise.all(promises);
      }

      setResult({ success, errors, total: rows.length });
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [file, campaignId, fields]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center gap-3 text-white">
            <Upload className="h-5 w-5" />
            <div>
              <h2 className="text-base font-semibold">Import Data</h2>
              <p className="text-xs text-emerald-100">{tplName(template.name)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Generate template button */}
          <button
            onClick={handleGenerateTemplate}
            className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10 p-4 text-left hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors"
          >
            <FileDown className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Download Reference Template</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                Generate an Excel template with {fields.length} fields ready for data entry
              </p>
            </div>
          </button>

          {/* File upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                : file
                  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/10'
                  : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
            )}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => { setFile(null); setResult(null); }}
                  className="mt-1 text-xs text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drag & drop your Excel file here
                </p>
                <p className="text-xs text-gray-400">or</p>
                <label className="cursor-pointer rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                  Browse files
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
                </label>
                <p className="mt-1 text-[10px] text-gray-400">.xlsx, .xls, .csv</p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={cn(
              'rounded-xl border p-4',
              result.errors === 0
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Import Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{result.total}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Total rows</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{result.success}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Success</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">{result.errors}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Errors</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Importing...' : `Import ${file ? `(${file.name.split('.').pop()?.toUpperCase()})` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Utility ──

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
