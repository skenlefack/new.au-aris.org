'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Eye } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import { computePaidFields, type PaidSubmissionData } from '@/lib/paid';

/**
 * Column mapping: Excel column index (0-based from row 10) → PAID field code
 * Based on PAID_2024 row 7 database field names.
 * Col A=0 (unique_id, skip), B=1 (reporting_quarter), etc.
 */
const COL_MAP: Record<number, string> = {
  1: 'reporting_quarter',     // B
  2: 'multicountry',          // C
  3: 'adm0_name',             // D - Country
  4: 'prj_symbol',            // E
  5: 'prj_title',             // F
  6: 'adm1_name',             // G
  7: 'adm2_name',             // H
  8: 'executive_partner',     // I
  9: 'implem_partner_intl',   // J
  10: 'implem_partner_local', // K
  11: 'prod_sector',          // L
  12: 'activity_type',        // M
  13: 'cva_delivery',         // N
  14: 'cash_amount',          // O (number)
  15: 'cash_plus',            // P
  16: 'species_variety',      // Q
  17: 'prod_system',          // R
  18: 'disease_pest',         // S
  19: 'unit_of_measure',      // T
  20: 'quantity_implemented',  // U (number)
  21: 'quantity_targeted_annual', // V (number)
  // W = cntr_ave_hh_size (computed)
  23: 'n_hh_benefitting',     // X (number)
  // Y = n_individuals_benefiting (computed)
  25: 'n_interv_per_hh',      // Z (number)
  // AA = n_benef_per_prj (computed)
  27: 'n_female_trained',     // AB (number)
  28: 'n_male_trained',       // AC (number)
  // AD = n_individual_trained (computed)
  // AE = perc_cntr_disabled_pop (computed)
  // AF = n_disabled_benef (computed)
  32: 'comments',             // AG
};

const NUMBER_FIELDS = new Set([
  'cash_amount', 'quantity_implemented', 'quantity_targeted_annual',
  'n_hh_benefitting', 'n_interv_per_hh', 'n_female_trained', 'n_male_trained',
]);

interface ParsedRow {
  rowNum: number;
  data: PaidSubmissionData;
  valid: boolean;
  errors: string[];
}

function parseExcelFile(buffer: ArrayBuffer): ParsedRow[] {
  // Dynamic import of xlsx to avoid SSR issues
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Find PAID sheet (PAID_2024 or PAID_2025 or first sheet)
  let sheetName = workbook.SheetNames.find((n: string) => n.startsWith('PAID_'));
  if (!sheetName) sheetName = workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Data starts at row 10 (index 9) — rows 1-9 are headers
  const dataStartIdx = 9;
  const results: ParsedRow[] = [];

  for (let i = dataStartIdx; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length < 5) continue;

    // Skip if no country (col D = index 3) and no project (col E = index 4)
    if (!row[3] && !row[4]) continue;

    const data: PaidSubmissionData = {};
    const errors: string[] = [];

    // Map columns to fields
    for (const [colStr, fieldCode] of Object.entries(COL_MAP)) {
      const colIdx = parseInt(colStr);
      const val = row[colIdx];
      if (val === '' || val === undefined || val === null) continue;

      if (NUMBER_FIELDS.has(fieldCode)) {
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        if (!isNaN(num)) {
          (data as any)[fieldCode] = num;
        }
      } else {
        (data as any)[fieldCode] = String(val).trim();
      }
    }

    // Validate required fields
    if (!data.adm0_name) errors.push('Missing country');
    if (!data.prod_sector) errors.push('Missing sector');

    // Compute derived fields
    const computed = computePaidFields(data);

    results.push({
      rowNum: i + 1, // 1-based Excel row number
      data: computed,
      valid: errors.length === 0,
      errors,
    });
  }

  return results;
}

// ── Preview column config ──
const PREVIEW_COLS = [
  { key: 'reporting_quarter', label: 'Quarter', width: 'w-16' },
  { key: 'adm0_name', label: 'Country', width: 'w-28' },
  { key: 'prj_symbol', label: 'Project', width: 'w-36' },
  { key: 'prod_sector', label: 'Sector', width: 'w-28' },
  { key: 'activity_type', label: 'Activity', width: 'w-40' },
  { key: 'quantity_implemented', label: 'Qty Impl.', width: 'w-20' },
  { key: 'n_hh_benefitting', label: 'HH', width: 'w-16' },
  { key: 'n_individuals_benefiting', label: 'Individuals', width: 'w-24' },
  { key: 'n_benef_per_prj', label: 'Beneficiaries', width: 'w-24' },
  { key: 'n_individual_trained', label: 'Trained', width: 'w-20' },
  { key: 'n_disabled_benef', label: 'Disabled', width: 'w-20' },
];

export default function PaidImportPage() {
  const t = useTranslations('paid');
  const { accessToken } = useAuthStore();

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'>('idle');
  const [importResult, setImportResult] = useState({ ok: 0, errors: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  const validRows = useMemo(() => parsedRows.filter((r) => r.valid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => !r.valid), [parsedRows]);

  // ── Parse file ──
  const parseFile = useCallback(async (f: File) => {
    setFile(f);
    setStatus('parsing');
    try {
      const buffer = await f.arrayBuffer();
      const rows = parseExcelFile(buffer);
      setParsedRows(rows);
      setStatus('preview');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse Excel file');
      setStatus('error');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      parseFile(f);
    }
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  }, [parseFile]);

  // ── Submit to API ──
  const handleImport = useCallback(async () => {
    setStatus('importing');
    let ok = 0;
    let errors = 0;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    for (const row of validRows) {
      try {
        const resp = await fetch(`${baseUrl}/api/v1/collecte/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            data: row.data,
            status: 'VALIDATED',
          }),
        });
        if (resp.ok) ok++;
        else errors++;
      } catch {
        errors++;
      }
    }

    setImportResult({ ok, errors });
    setStatus('done');
  }, [validRows, accessToken]);

  // ── Reset ──
  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setStatus('idle');
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/paid-collecte" className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('importExcel')}</h1>
          <p className="text-sm text-gray-500">{t('importExcelDesc')}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Import Format</h3>
        <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-400">
          <li>Upload the standard AU-IBAR PAID Excel file (.xlsx)</li>
          <li>The system reads PAID_2024 or PAID_2025 sheet (data rows start at row 10)</li>
          <li>Computed fields (individuals, beneficiaries, trained, disabled) are recalculated automatically</li>
          <li>Country HH size and disability % are auto-looked up from ARIS referentials</li>
          <li>Imported records are set to VALIDATED status (historical data)</li>
        </ul>
      </div>

      {/* ── Drop zone ── */}
      {status === 'idle' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-600"
        >
          <FileSpreadsheet className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            Drag & drop your PAID Excel file here
          </p>
          <p className="mt-1 text-xs text-gray-400">or</p>
          <label className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Upload className="mr-1.5 inline h-4 w-4" />
            Browse files
            <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>
      )}

      {/* ── Parsing spinner ── */}
      {status === 'parsing' && (
        <div className="flex flex-col items-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">Parsing Excel file...</p>
        </div>
      )}

      {/* ── Preview ── */}
      {status === 'preview' && file && (
        <div className="space-y-4">
          {/* File info + stats */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {parsedRows.length} rows parsed
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {invalidRows.length} invalid
                </span>
              )}
            </div>
          </div>

          {/* Preview table */}
          <div className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Row</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500">Status</th>
                  {PREVIEW_COLS.map((col) => (
                    <th key={col.key} className="px-2 py-2 text-left font-semibold text-gray-500">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 100).map((row) => (
                  <tr key={row.rowNum} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                    <td className="px-2 py-1.5 text-gray-400">{row.rowNum}</td>
                    <td className="px-2 py-1.5">
                      {row.valid ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <span title={row.errors.join(', ')}>
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        </span>
                      )}
                    </td>
                    {PREVIEW_COLS.map((col) => {
                      const val = (row.data as any)[col.key];
                      return (
                        <td key={col.key} className="max-w-[160px] truncate px-2 py-1.5 text-gray-700 dark:text-gray-300" title={String(val ?? '')}>
                          {typeof val === 'number' ? (Number.isInteger(val) ? val.toLocaleString() : val.toFixed(1)) : (val ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 100 && (
              <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400 dark:border-gray-800">
                Showing 100 of {parsedRows.length} rows
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={validRows.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="mr-1.5 inline h-4 w-4" />
              Import {validRows.length} Valid Rows
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Importing ── */}
      {status === 'importing' && (
        <div className="flex flex-col items-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            Importing {validRows.length} PAID records...
          </p>
        </div>
      )}

      {/* ── Done ── */}
      {status === 'done' && (
        <div className="flex flex-col items-center rounded-xl border border-green-200 bg-green-50 py-12 dark:border-green-800 dark:bg-green-950/20">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <h3 className="mt-4 text-lg font-semibold text-green-800 dark:text-green-300">Import Complete</h3>
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            {importResult.ok} records imported successfully
            {importResult.errors > 0 && `, ${importResult.errors} failed`}
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/paid-collecte" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Back to Dashboard
            </Link>
            <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Import Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {status === 'error' && (
        <div className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 py-12 dark:border-red-800 dark:bg-red-950/20">
          <AlertTriangle className="h-12 w-12 text-red-600" />
          <h3 className="mt-4 text-lg font-semibold text-red-800 dark:text-red-300">Import Failed</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          <button onClick={reset} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
