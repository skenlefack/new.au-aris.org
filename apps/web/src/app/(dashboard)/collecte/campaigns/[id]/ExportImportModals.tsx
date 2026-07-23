'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useAuthStore } from '@/lib/stores/auth-store';
import type { FormTemplateListItem } from '@/lib/api/form-builder-hooks';
import { COUNTRIES } from '@/data/countries-config';
import { ADMIN_DIVISIONS } from '@/data/admin-divisions';

// ── Types ──

interface SchemaSection {
  name?: { en?: string; fr?: string };
  order?: number;
  fields?: SchemaField[];
  conditions?: SchemaCondition[];
}

interface SchemaCondition {
  id?: string;
  type?: string;
  action?: 'show' | 'hide' | 'enable' | 'disable' | 'setRequired' | 'setValue';
  logic?: 'all' | 'any';
  rules?: { field: string; operator: string; value: unknown }[];
}

interface SchemaField {
  code?: string;
  type?: string;
  label?: { en?: string; fr?: string };
  helpText?: { en?: string; fr?: string };
  required?: boolean;
  hidden?: boolean;
  properties?: Record<string, unknown>;
  conditions?: SchemaCondition[];
}

interface SelectOpt {
  label?: { en?: string; fr?: string };
  value?: string;
}

function ml(t?: { en?: string; fr?: string }, locale?: string): string {
  if (!t) return '';
  if (locale && (t as any)[locale]) return (t as any)[locale];
  return t?.en || t?.fr || '';
}

// Country code → name map
const COUNTRY_MAP: Record<string, string> = {};
for (const [code, c] of Object.entries(COUNTRIES)) {
  COUNTRY_MAP[code.toUpperCase()] = c.name;
  COUNTRY_MAP[code.toLowerCase()] = c.name;
}

// GADM gid → name map for admin divisions (admin1 + admin2)
const GADM_MAP: Record<string, string> = {};
for (const [, countryData] of Object.entries(ADMIN_DIVISIONS)) {
  for (const a1 of countryData.admin1 || []) GADM_MAP[a1.gid] = a1.name;
  for (const a2 of countryData.admin2 || []) GADM_MAP[a2.gid] = a2.name;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_LEVEL_LABELS: Record<number, string> = {
  0: 'Pays', 1: 'Admin1 (Région/Province)', 2: 'Admin2 (District/Département)',
  3: 'Admin3 (Sous-district/Commune)', 4: 'Admin4 (Quartier/Village)', 5: 'Admin5 (Localité)',
};

function resolveAdminValue(val: string | undefined, level: number, geoMap?: Record<string, string>): string {
  if (!val) return '';
  if (val.startsWith('__new:')) return val.slice(6);
  if (level === 0) return COUNTRY_MAP[val] || COUNTRY_MAP[val.toUpperCase()] || val;
  return GADM_MAP[val] || geoMap?.[val] || val;
}

async function fetchRefData(type: string, locale = 'en'): Promise<Record<string, string>> {
  const token = useAuthStore.getState().accessToken || '';
  try {
    const res = await fetch(`/api/v1/master-data/ref/${type}/for-select?limit=10000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, string> = {};
    for (const item of json?.data || []) {
      if (!item.id) continue;
      const name = item.name;
      let label = item.label || '';
      if (!label && name) {
        if (typeof name === 'string') label = name;
        else if (typeof name === 'object') label = (name as any)[locale] || name.en || name.fr || name.pt || Object.values(name).find((v: any) => v) || '';
      }
      if (!label) label = item.code || '';
      if (label) {
        map[item.id] = label;
        // Also map by code for non-UUID lookups
        if (item.code) map[item.code] = label;
      }
    }
    return map;
  } catch { return {}; }
}

/** Fetch geo-entities (admin divisions) for resolving admin3+ levels */
async function fetchGeoEntities(locale = 'en'): Promise<Record<string, string>> {
  const token = useAuthStore.getState().accessToken || '';
  try {
    const res = await fetch('/api/v1/master-data/ref/geo-entities/for-select?limit=10000', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, string> = {};
    for (const item of json?.data || []) {
      if (!item.id) continue;
      const name = item.name;
      const label = name ? ((name as any)[locale] || name.en || name.fr || '') : '';
      if (label) {
        map[item.id] = label;
        if (item.code) map[item.code] = label;
      }
    }
    return map;
  } catch { return {}; }
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

interface ExportField {
  code: string;
  label: string;
  type: string;
  levels?: number[];
  masterDataType?: string;
  options?: { label: string; value: string }[];
}

function flattenFields(sections: SchemaSection[]): ExportField[] {
  const rows: ExportField[] = [];
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const sec of sorted) {
    for (const f of sec.fields || []) {
      if (f.code) {
        const props = f.properties || {};
        const opts = ((props.options || []) as SelectOpt[]).map((o) => ({
          label: ml(o.label) || o.value || '',
          value: o.value || '',
        }));
        rows.push({
          code: f.code,
          label: ml(f.label) || f.code,
          type: f.type || 'text',
          levels: f.type === 'admin-location' ? ((props.levels as number[]) || [0, 1, 2]) : undefined,
          masterDataType: (props.masterDataType || props.referenceType) as string | undefined,
          options: opts.length > 0 ? opts : undefined,
        });
      }
    }
  }
  return rows;
}

interface ExportColumn {
  header: string;
  getValue: (row: Record<string, unknown>, refMap: Record<string, string>) => string;
}

function buildExportColumns(fields: ExportField[], geoMap?: Record<string, string>): ExportColumn[] {
  const cols: ExportColumn[] = [];
  for (const field of fields) {
    if (field.type === 'admin-location' && field.levels) {
      for (const level of field.levels) {
        cols.push({
          header: ADMIN_LEVEL_LABELS[level] || `Admin${level}`,
          getValue: (row) => {
            const loc = row[field.code];
            if (!loc || typeof loc !== 'object' || Array.isArray(loc)) return '';
            return resolveAdminValue((loc as Record<string, string>)[`level_${level}`], level, geoMap);
          },
        });
      }
    } else {
      cols.push({
        header: field.label,
        getValue: (row, refMap) => {
          const val = row[field.code];
          if (val === null || val === undefined || val === '') return '';
          // Select with options
          if (field.options && typeof val === 'string') {
            const opt = field.options.find((o) => o.value === val);
            if (opt) return opt.label;
          }
          // UUID → refMap
          if (typeof val === 'string' && UUID_RE.test(val)) return refMap[val] || val;
          // Non-UUID string that might be a code in refMap
          if (typeof val === 'string' && field.masterDataType && refMap[val]) return refMap[val];
          // Array
          if (Array.isArray(val)) {
            if (val.length === 0) return '';
            // Array of strings (UUIDs or codes)
            if (typeof val[0] === 'string') return val.map((v) => (UUID_RE.test(v) ? (refMap[v] || v) : (refMap[v] || v))).join(', ');
            // Array of objects (repeater rows) — resolve UUIDs inside
            if (typeof val[0] === 'object') {
              return val.map((item, i) => {
                if (typeof item !== 'object' || !item) return String(item);
                const parts: string[] = [];
                for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
                  let display = '';
                  if (typeof v === 'string' && UUID_RE.test(v)) {
                    display = refMap[v] || v;
                  } else if (typeof v === 'boolean') {
                    display = v ? 'Yes' : 'No';
                  } else if (v !== null && v !== undefined) {
                    display = String(v);
                  }
                  if (display) parts.push(`${k}: ${display}`);
                }
                return `[${i + 1}] ${parts.join(', ')}`;
              }).join(' | ');
            }
            return `${val.length} item(s)`;
          }
          // Geo coordinates
          if (field.type === 'geo-selector' && typeof val === 'object' && !Array.isArray(val)) {
            const geo = val as { lat?: number; lng?: number };
            if (geo.lat && geo.lng) return `${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`;
            return '';
          }
          if (typeof val === 'boolean') return val ? 'Yes' : 'No';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        },
      });
    }
  }
  return cols;
}

// ── Template field extraction (enriched for template generation) ──

interface TemplateField {
  code: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string;
  masterDataType?: string;
  options?: { label: string; value: string }[];
  levels?: number[];
  /** Condition: field only shows when this condition is met */
  conditionText?: string;
  /** Parent filter: this field's options depend on another field */
  parentFilterText?: string;
  parentFilterField?: string;
}

function extractTemplateFields(sections: SchemaSection[]): TemplateField[] {
  const rows: TemplateField[] = [];
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const sec of sorted) {
    for (const f of sec.fields || []) {
      if (!f.code || f.hidden) continue;
      if (['heading', 'divider', 'spacer', 'info-box'].includes(f.type || '')) continue;
      const props = f.properties || {};
      const opts = ((props.options || []) as SelectOpt[]).map((o) => ({
        label: ml(o.label) || o.value || '',
        value: o.value || '',
      }));

      // Parse conditions for visibility
      let conditionText: string | undefined;
      const conds = f.conditions || [];
      const showConds = conds.filter((c) => c.action === 'show' || c.action === 'hide');
      if (showConds.length > 0) {
        const parts: string[] = [];
        for (const cond of showConds) {
          for (const rule of cond.rules || []) {
            const op = rule.operator === 'equals' ? '=' :
              rule.operator === 'notEquals' ? '!=' :
              rule.operator === 'isNotEmpty' ? 'is filled' :
              rule.operator === 'isEmpty' ? 'is empty' :
              rule.operator === 'in' ? 'in' : rule.operator;
            const valStr = rule.value === null || rule.value === undefined ? ''
              : Array.isArray(rule.value) ? (rule.value as string[]).join(', ')
              : String(rule.value);
            parts.push(`${cond.action === 'hide' ? 'Hidden' : 'Visible'} when "${rule.field}" ${op} ${valStr}`.trim());
          }
        }
        if (parts.length > 0) conditionText = parts.join(' ; ');
      }

      // Parse parent filter / cascade
      let parentFilterText: string | undefined;
      let parentFilterField: string | undefined;
      const pf = props.parentFilter as Record<string, string> | undefined;
      const cascadeSource = props.cascadeSource as string | undefined;
      if (pf) {
        const entries = Object.entries(pf);
        if (entries.length > 0) {
          const refs = entries.map(([, v]) => typeof v === 'string' && v.startsWith('$') ? v.slice(1) : v);
          parentFilterField = refs[0];
          parentFilterText = `Filtered by: ${refs.join(', ')}`;
        }
      } else if (cascadeSource) {
        parentFilterField = cascadeSource;
        parentFilterText = `Filtered by: ${cascadeSource}`;
      }

      rows.push({
        code: f.code,
        label: ml(f.label) || f.code,
        type: f.type || 'text',
        required: f.required === true,
        helpText: ml(f.helpText) || undefined,
        masterDataType: (props.masterDataType || props.referenceType) as string | undefined,
        options: opts.length > 0 ? opts : undefined,
        levels: f.type === 'admin-location' ? ((props.levels as number[]) || [0, 1, 2]) : undefined,
        conditionText,
        parentFilterText,
        parentFilterField,
      });
    }
  }
  return rows;
}

/** Fetch ref data and return both id→label and label→id maps */
async function fetchRefDataBidirectional(type: string): Promise<{ idToLabel: Record<string, string>; labelToId: Record<string, string> }> {
  const token = useAuthStore.getState().accessToken || '';
  try {
    const res = await fetch(`/api/v1/master-data/ref/${type}/for-select?limit=15000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { idToLabel: {}, labelToId: {} };
    const json = await res.json();
    const idToLabel: Record<string, string> = {};
    const labelToId: Record<string, string> = {};
    for (const item of json?.data || []) {
      if (!item.id) continue;
      const name = item.name;
      let label = item.label || '';
      if (!label && name) {
        if (typeof name === 'string') label = name;
        else if (typeof name === 'object') label = name.en || name.fr || name.pt || Object.values(name).find((v: any) => v) || '';
      }
      if (!label) label = item.code || '';
      if (label) {
        idToLabel[item.id] = label;
        labelToId[label] = item.id;
      }
    }
    return { idToLabel, labelToId };
  } catch { return { idToLabel: {}, labelToId: {} }; }
}

// Country list for admin-location dropdowns
const COUNTRY_NAMES = Object.entries(COUNTRIES)
  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
  .map(([code, c]) => ({ code: code.toUpperCase(), name: c.name }));

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
  const [refMap, setRefMap] = useState<Record<string, string>>({});

  const schema = template.schema as { sections?: SchemaSection[] } | undefined;
  const fields = useMemo(() => flattenFields(schema?.sections || []), [schema]);
  const [geoMap, setGeoMap] = useState<Record<string, string>>({});
  const exportColumns = useMemo(() => buildExportColumns(fields, geoMap), [fields, geoMap]);

  // Load reference data for resolving UUIDs + geo-entities for admin divisions
  const [refFetched, setRefFetched] = useState(false);
  useEffect(() => {
    if (open && fields.length > 0 && !refFetched) {
      setRefFetched(true);
      const mdTypes = new Set<string>();
      for (const f of fields) {
        if (f.masterDataType) mdTypes.add(f.masterDataType);
      }
      mdTypes.add('diseases'); mdTypes.add('species'); mdTypes.add('breeds');
      mdTypes.add('age-groups'); mdTypes.add('vaccine-types'); mdTypes.add('control-measures');
      mdTypes.add('production-systems'); mdTypes.add('sample-types'); mdTypes.add('test-types');
      mdTypes.add('labs'); mdTypes.add('gear-types'); mdTypes.add('commodities');
      mdTypes.add('countries');
      Promise.all([
        ...([...mdTypes].map((type) => fetchRefData(type, locale))),
        fetchGeoEntities(locale),
      ]).then((maps) => {
        const geoResult = maps.pop() as Record<string, string>;
        setGeoMap(geoResult);
        const merged: Record<string, string> = {};
        for (const m of maps) Object.assign(merged, m as Record<string, string>);
        setRefMap(merged);
      });
    }
  }, [open, fields, refFetched, locale]);

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
          setError(t('noDataToExport'));
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
          const headers = exportColumns.map((c) => c.header);
          const csvRows = filtered.map((s: any) =>
            exportColumns.map((c) => `"${c.getValue(s.data || {}, refMap).replace(/"/g, '""')}"`).join(','),
          );
          const csv = [headers.join(','), ...csvRows].join('\n');
          downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `${tplName(template.name)}_export.csv`);
        } else {
          // XLSX export
          const ExcelJS = (await import('exceljs')).default;
          const wb = new ExcelJS.Workbook();
          wb.creator = 'ARIS 4.0 — AU-IBAR';
          const ws = wb.addWorksheet('Data');

          // Header row with expanded columns
          const headerRow = ws.addRow(exportColumns.map((c) => c.header));
          headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
            cell.alignment = { horizontal: 'center' };
          });

          // Data rows with resolved values
          for (const sub of filtered) {
            ws.addRow(exportColumns.map((c) => c.getValue(sub.data || {}, refMap)));
          }

          // Auto-width columns
          ws.columns.forEach((col, i) => {
            col.width = Math.max(14, (exportColumns[i]?.header.length ?? 10) + 4);
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
      setError(err?.message || t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [campaignId, format, filters, exportColumns, refMap, tplName(template.name)]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <Download className="h-5 w-5" />
            <div>
              <h2 className="text-base font-semibold">{t('exportData')}</h2>
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
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('format')}</label>
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
                {t('filters')} {activeFilterCount > 0 && <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 text-[10px] dark:bg-blue-900/30 dark:text-blue-300">{activeFilterCount}</span>}
              </label>
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters({})} className="text-[10px] text-red-500 hover:text-red-600">
                  {t('clearAll')}
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
                    placeholder={t('filterByField', { field: f.label })}
                    value={filters[f.code] || ''}
                    onChange={(e) => handleFilterChange(f.code, e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
              ))}
              {filterableFields.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">{t('noFilterableFields')}</p>
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
            {t('cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? t('exporting') : t('exportFormat', { format: format.toUpperCase() })}
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
      setError(t('uploadExcelCsvError'));
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

  // Extract enriched template fields
  const tplFields = useMemo(() => extractTemplateFields(schema?.sections || []), [schema]);

  const [generating, setGenerating] = useState(false);

  const handleGenerateTemplate = useCallback(async () => {
    setGenerating(true);
    try {
      // 1. Fetch all master-data reference values
      const mdTypes = new Set<string>();
      for (const f of tplFields) {
        if (f.masterDataType) mdTypes.add(f.masterDataType);
      }
      const refDataMap: Record<string, { labels: string[]; idToLabel: Record<string, string>; labelToId: Record<string, string> }> = {};
      const fetches = await Promise.all(
        [...mdTypes].map(async (type) => {
          const data = await fetchRefDataBidirectional(type);
          return { type, ...data };
        }),
      );
      for (const { type, idToLabel, labelToId } of fetches) {
        refDataMap[type] = { labels: Object.values(idToLabel).sort(), idToLabel, labelToId };
      }

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'ARIS 4.0 — AU-IBAR';

      // ── Build column list (expand admin-location into separate columns) ──
      interface TplCol {
        code: string;       // field code (for row 1)
        label: string;      // display label (for row 2)
        type: string;       // field type
        required: boolean;
        helpText?: string;
        conditionText?: string;
        parentFilterText?: string;
        /** For static selects: option labels */
        selectOptions?: string[];
        /** For master-data-select: ref data type key */
        refDataType?: string;
        /** For admin-location sub-columns */
        adminLevel?: number;
        /** Original field code (for admin-location sub-columns) */
        sourceFieldCode?: string;
      }

      const columns: TplCol[] = [];
      for (const f of tplFields) {
        if (f.type === 'admin-location' && f.levels) {
          for (const level of f.levels) {
            columns.push({
              code: level === 0 ? `${f.code}__country` : `${f.code}__admin${level}`,
              label: ADMIN_LEVEL_LABELS[level] || `Admin${level}`,
              type: 'admin-location-level',
              required: f.required && level === 0,
              helpText: level === 0 ? 'Select the country name' : `Select Admin level ${level} division`,
              conditionText: f.conditionText,
              adminLevel: level,
              sourceFieldCode: f.code,
              selectOptions: level === 0 ? COUNTRY_NAMES.map((c) => c.name) : undefined,
            });
          }
        } else if (f.type === 'repeater' || f.type === 'matrix') {
          // Skip complex nested fields — document in instructions
          columns.push({
            code: f.code, label: f.label, type: f.type, required: f.required,
            helpText: `Complex field (${f.type}) — fill via the web/mobile app`,
            conditionText: f.conditionText,
          });
        } else {
          columns.push({
            code: f.code,
            label: f.label,
            type: f.type,
            required: f.required,
            helpText: f.helpText,
            conditionText: f.conditionText,
            parentFilterText: f.parentFilterText,
            selectOptions: f.options?.map((o) => o.label),
            refDataType: f.masterDataType,
          });
        }
      }

      // ── Create reference data sheets (hidden) ──
      const refSheetNames: Record<string, string> = {};
      for (const [type, data] of Object.entries(refDataMap)) {
        if (data.labels.length === 0) continue;
        // Excel sheet name max 31 chars
        const sheetName = `_ref_${type}`.slice(0, 31);
        refSheetNames[type] = sheetName;
        const refSheet = wb.addWorksheet(sheetName);
        refSheet.state = 'veryHidden'; // hidden from user but accessible for formulas
        refSheet.getColumn(1).width = 40;
        refSheet.getColumn(2).width = 40;
        // Header
        refSheet.addRow(['Label', 'ID']);
        for (const label of data.labels) {
          refSheet.addRow([label, data.labelToId[label] || '']);
        }
      }

      // Also create a country reference sheet
      const countrySheetName = '_ref_countries';
      const csSheet = wb.addWorksheet(countrySheetName);
      csSheet.state = 'veryHidden';
      csSheet.getColumn(1).width = 30;
      csSheet.getColumn(2).width = 5;
      csSheet.addRow(['Name', 'Code']);
      for (const c of COUNTRY_NAMES) {
        csSheet.addRow([c.name, c.code]);
      }

      // ── Data Entry sheet ──
      const ws = wb.addWorksheet('Data Entry', {
        properties: { defaultColWidth: 18 },
        views: [{ state: 'frozen', ySplit: 2 }],
      });

      const DATA_START_ROW = 3;
      const DATA_ROWS = 200;

      // Colors
      const BLUE_BG = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E40AF' } };
      const GRAY_BG = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } };
      const ORANGE_BG = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF3E0' } };
      const GREEN_BG = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8F5E9' } };

      // Row 1: Field codes (system row)
      const codeRow = ws.addRow(columns.map((c) => c.code));
      codeRow.eachCell((cell, colIdx) => {
        const col = columns[colIdx - 1];
        const isConditional = !!col?.conditionText;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = isConditional
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED6C02' } } // orange for conditional
          : BLUE_BG;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
      });

      // Row 2: Labels + type + required indicator
      const labelRow = ws.addRow(columns.map((c) => {
        let label = c.label;
        if (c.required) label += ' *';
        return label;
      }));
      labelRow.eachCell((cell, colIdx) => {
        const col = columns[colIdx - 1];
        cell.font = { bold: true, size: 10, color: { argb: col?.required ? 'FFC62828' : 'FF333333' } };
        cell.fill = col?.conditionText ? ORANGE_BG : GRAY_BG;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Add comment with help text, condition, cascade info
        const notes: string[] = [];
        if (col?.required) notes.push('REQUIRED FIELD');
        if (col?.helpText) notes.push(col.helpText);
        const typeLabel = col?.type === 'master-data-select' ? `Select from list (${col.refDataType})`
          : col?.type === 'select' ? 'Select from dropdown'
          : col?.type === 'date' ? 'Format: YYYY-MM-DD'
          : col?.type === 'number' ? 'Numeric value'
          : col?.type === 'checkbox' || col?.type === 'toggle' ? 'Yes / No'
          : col?.type === 'geo-selector' ? 'Format: lat, lng (ex: -1.2921, 36.8219)'
          : col?.type === 'repeater' || col?.type === 'matrix' ? 'Complex field — use web/mobile app'
          : col?.type === 'admin-location-level' ? 'Select from dropdown'
          : col?.type === 'text' ? 'Free text'
          : col?.type === 'textarea' ? 'Free text (multiline)'
          : col?.type || '';
        notes.push(`Type: ${typeLabel}`);
        if (col?.conditionText) notes.push(`CONDITIONAL: ${col.conditionText}`);
        if (col?.parentFilterText) notes.push(`CASCADE: ${col.parentFilterText}`);
        if (notes.length > 0) {
          cell.note = { texts: [{ text: notes.join('\n'), font: { size: 9 } }] };
        }
      });

      // Apply data validation (dropdowns) to data rows
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx];
        const colLetter = ws.getColumn(colIdx + 1).letter;

        if (col.type === 'admin-location-level' && col.adminLevel === 0) {
          // Country dropdown from hidden reference sheet
          const count = COUNTRY_NAMES.length;
          for (let r = DATA_START_ROW; r < DATA_START_ROW + DATA_ROWS; r++) {
            const cell = ws.getCell(`${colLetter}${r}`);
            cell.dataValidation = {
              type: 'list',
              formulae: [`'${countrySheetName}'!$A$2:$A$${count + 1}`],
              showErrorMessage: true,
              errorTitle: 'Invalid country',
              error: 'Please select a country from the list',
            };
          }
        } else if (col.selectOptions && col.selectOptions.length > 0) {
          // Static select options — inline if short, reference sheet if long
          const joined = col.selectOptions.map((o) => o.replace(/,/g, '')).join(',');
          if (joined.length <= 250) {
            for (let r = DATA_START_ROW; r < DATA_START_ROW + DATA_ROWS; r++) {
              const cell = ws.getCell(`${colLetter}${r}`);
              cell.dataValidation = {
                type: 'list',
                formulae: [`"${joined}"`],
                showErrorMessage: true,
                errorTitle: 'Invalid value',
                error: `Please select: ${col.selectOptions.slice(0, 5).join(', ')}${col.selectOptions.length > 5 ? '...' : ''}`,
              };
            }
          }
        } else if (col.refDataType && refSheetNames[col.refDataType]) {
          // Master-data-select dropdown from hidden reference sheet
          const sheetName = refSheetNames[col.refDataType];
          const count = refDataMap[col.refDataType]?.labels.length || 0;
          if (count > 0) {
            for (let r = DATA_START_ROW; r < DATA_START_ROW + DATA_ROWS; r++) {
              const cell = ws.getCell(`${colLetter}${r}`);
              cell.dataValidation = {
                type: 'list',
                formulae: [`'${sheetName}'!$A$2:$A$${count + 1}`],
                showErrorMessage: true,
                errorTitle: 'Invalid value',
                error: `Please select a valid ${col.label} from the dropdown list`,
              };
            }
          }
        } else if (col.type === 'checkbox' || col.type === 'toggle') {
          for (let r = DATA_START_ROW; r < DATA_START_ROW + DATA_ROWS; r++) {
            const cell = ws.getCell(`${colLetter}${r}`);
            cell.dataValidation = {
              type: 'list',
              formulae: ['"Yes,No"'],
              showErrorMessage: true,
              errorTitle: 'Invalid value',
              error: 'Please select Yes or No',
            };
          }
        }

        // Color data cells for conditional columns
        if (col.conditionText) {
          for (let r = DATA_START_ROW; r < DATA_START_ROW + DATA_ROWS; r++) {
            const cell = ws.getCell(`${colLetter}${r}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
          }
        }

        // Light green for required columns
        if (col.required && !col.conditionText) {
          for (let r = DATA_START_ROW; r < DATA_START_ROW + DATA_ROWS; r++) {
            const cell = ws.getCell(`${colLetter}${r}`);
            cell.fill = GREEN_BG;
          }
        }
      }

      // Auto-width columns
      ws.columns.forEach((col, i) => {
        const c = columns[i];
        col.width = Math.max(16, (c?.label.length ?? 10) + 6);
      });

      // ── Instructions sheet ──
      const wsInst = wb.addWorksheet('Instructions');
      wsInst.getColumn(1).width = 25;
      wsInst.getColumn(2).width = 35;
      wsInst.getColumn(3).width = 20;
      wsInst.getColumn(4).width = 15;
      wsInst.getColumn(5).width = 40;
      wsInst.getColumn(6).width = 40;
      wsInst.getColumn(7).width = 40;

      // Title
      const titleRow = wsInst.addRow(['ARIS 4.0 — Import Template']);
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
      wsInst.addRow([`Form: ${tplName(template.name)}`]).getCell(1).font = { bold: true, size: 11 };
      wsInst.addRow([`Version: ${template.version}`]);
      wsInst.addRow([`Fields: ${columns.length}`]);
      wsInst.addRow([`Generated: ${new Date().toLocaleDateString()}`]);
      wsInst.addRow(['']);

      // General instructions
      const instrTitle = wsInst.addRow(['INSTRUCTIONS']);
      instrTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E40AF' } };
      wsInst.addRow(['1. Go to the "Data Entry" sheet to fill in data']);
      wsInst.addRow(['2. Row 1 contains field CODES — DO NOT MODIFY']);
      wsInst.addRow(['3. Row 2 contains field labels with * for required fields']);
      wsInst.addRow(['4. Start entering data from row 3 (one submission per row)']);
      wsInst.addRow(['5. Fields with dropdowns: click the cell and select from the list']);
      wsInst.addRow(['6. Hover over column headers (row 2) to see detailed instructions']);
      wsInst.addRow(['7. Orange columns = conditional fields (may not always apply)']);
      wsInst.addRow(['8. Green cells = required fields that must be filled']);
      wsInst.addRow(['9. For cascade fields, fill the parent first, then the child']);
      wsInst.addRow(['10. Dates must use YYYY-MM-DD format (e.g. 2026-01-15)']);
      wsInst.addRow(['11. Coordinates: latitude, longitude (e.g. -1.2921, 36.8219)']);
      wsInst.addRow(['']);

      // Color legend
      const legendTitle = wsInst.addRow(['COLOR LEGEND']);
      legendTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E40AF' } };
      const legend = [
        { color: 'FF1E40AF', text: 'Blue header', desc: 'Standard field' },
        { color: 'FFED6C02', text: 'Orange header', desc: 'Conditional field (depends on another field value)' },
        { color: 'FFE8F5E9', text: 'Green cell', desc: 'Required field' },
        { color: 'FFFFFDE7', text: 'Yellow cell', desc: 'Conditional field (fill only if condition is met)' },
      ];
      for (const l of legend) {
        const row = wsInst.addRow([l.text, l.desc]);
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: l.color } };
        row.getCell(1).font = { bold: true, color: { argb: l.color === 'FFE8F5E9' || l.color === 'FFFFFDE7' ? 'FF333333' : 'FFFFFFFF' } };
      }
      wsInst.addRow(['']);

      // Field reference table
      const refTitle = wsInst.addRow(['FIELD REFERENCE']);
      refTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E40AF' } };
      const refHeader = wsInst.addRow(['Code', 'Label', 'Type', 'Required', 'Accepted Values', 'Condition', 'Cascade']);
      refHeader.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      });

      for (const col of columns) {
        let acceptedValues = '';
        if (col.selectOptions && col.selectOptions.length > 0) {
          acceptedValues = col.selectOptions.join(', ');
        } else if (col.refDataType && refDataMap[col.refDataType]) {
          const labels = refDataMap[col.refDataType].labels;
          acceptedValues = labels.length <= 15
            ? labels.join(', ')
            : `${labels.slice(0, 10).join(', ')} ... (${labels.length} total)`;
        } else if (col.type === 'date') {
          acceptedValues = 'YYYY-MM-DD';
        } else if (col.type === 'number') {
          acceptedValues = 'Numeric';
        } else if (col.type === 'checkbox' || col.type === 'toggle') {
          acceptedValues = 'Yes, No';
        } else if (col.type === 'geo-selector') {
          acceptedValues = 'lat, lng';
        } else if (col.type === 'admin-location-level' && col.adminLevel === 0) {
          acceptedValues = `Country name (${COUNTRY_NAMES.length} countries)`;
        }

        wsInst.addRow([
          col.code,
          col.label + (col.required ? ' *' : ''),
          col.type === 'master-data-select' ? `Reference (${col.refDataType})` : col.type,
          col.required ? 'YES' : 'No',
          acceptedValues,
          col.conditionText || '',
          col.parentFilterText || '',
        ]);
      }

      wsInst.addRow(['']);

      // Cascade dependencies documentation
      const cascadeFields = columns.filter((c) => c.parentFilterText);
      if (cascadeFields.length > 0) {
        const cascTitle = wsInst.addRow(['CASCADE DEPENDENCIES']);
        cascTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFED6C02' } };
        wsInst.addRow(['The following fields filter their options based on another field:']);
        wsInst.addRow(['']);
        const cascHdr = wsInst.addRow(['Child Field', 'Parent Field', 'Instructions']);
        cascHdr.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        });
        for (const c of cascadeFields) {
          wsInst.addRow([
            c.label,
            c.parentFilterText?.replace('Filtered by: ', '') || '',
            `Fill "${c.parentFilterText?.replace('Filtered by: ', '')}" FIRST. The dropdown for "${c.label}" shows all values — select the correct one for the chosen parent.`,
          ]);
        }
        wsInst.addRow(['']);
      }

      // Conditional fields documentation
      const condFields = columns.filter((c) => c.conditionText);
      if (condFields.length > 0) {
        const condTitle = wsInst.addRow(['CONDITIONAL FIELDS']);
        condTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFED6C02' } };
        wsInst.addRow(['These fields only apply when certain conditions are met:']);
        wsInst.addRow(['']);
        const condHdr = wsInst.addRow(['Field', 'Condition', 'Instructions']);
        condHdr.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
        });
        for (const c of condFields) {
          wsInst.addRow([
            c.label,
            c.conditionText || '',
            `Only fill this field when the condition is met. Leave empty otherwise.`,
          ]);
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `ARIS_Import_Template_${tplName(template.name).replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    } catch (err) {
      console.error('[Template] Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [tplFields, tplName(template.name), template.version, schema]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    setResult(null);

    try {
      // 1. Fetch reference data for resolving labels → UUIDs
      const mdTypes = new Set<string>();
      for (const f of tplFields) {
        if (f.masterDataType) mdTypes.add(f.masterDataType);
      }
      const labelToIdMaps: Record<string, Record<string, string>> = {};
      if (mdTypes.size > 0) {
        const fetches = await Promise.all(
          [...mdTypes].map(async (type) => {
            const data = await fetchRefDataBidirectional(type);
            return { type, labelToId: data.labelToId };
          }),
        );
        for (const { type, labelToId } of fetches) {
          labelToIdMaps[type] = labelToId;
        }
      }

      // Build reverse country name → code map
      const countryNameToCode: Record<string, string> = {};
      for (const c of COUNTRY_NAMES) {
        countryNameToCode[c.name.toLowerCase()] = c.code;
      }

      // Build select option label → value maps
      const selectLabelToValue: Record<string, Record<string, string>> = {};
      for (const f of tplFields) {
        if (f.options) {
          const map: Record<string, string> = {};
          for (const o of f.options) { map[o.label.toLowerCase()] = o.value; }
          selectLabelToValue[f.code] = map;
        }
      }

      // Identify admin-location fields for reconstruction
      const adminLocationFields = tplFields.filter((f) => f.type === 'admin-location' && f.levels);

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await wb.xlsx.load(buffer);

      // Read first sheet
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) {
        setError(t('fileEmptyOrNoData'));
        setImporting(false);
        return;
      }

      // Row 1 = field codes (headers)
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim();
      });

      // Skip row 2 if it looks like labels
      const row2Val = String(ws.getRow(2).getCell(1).value ?? '');
      const isLabelRow = tplFields.some((f) => f.label === row2Val) || row2Val.endsWith(' *');
      const startRow = isLabelRow ? 3 : 2;

      // Parse data rows
      const rows: Record<string, unknown>[] = [];
      for (let r = startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        if (!row || row.cellCount === 0) continue;

        const rawData: Record<string, unknown> = {};
        let hasValue = false;
        headers.forEach((header, idx) => {
          if (!header) return;
          const cell = row.getCell(idx + 1);
          const val = cell.value;
          if (val !== null && val !== undefined && val !== '') {
            rawData[header] = val;
            hasValue = true;
          }
        });
        if (!hasValue) continue;

        // Resolve labels → IDs/values
        const resolvedData: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(rawData)) {
          const strVal = String(val).trim();

          // Check if this is an admin-location sub-column
          const adminMatch = key.match(/^(.+)__(country|admin(\d))$/);
          if (adminMatch) {
            // Will be reconstructed below
            resolvedData[key] = strVal;
            continue;
          }

          // Find the template field
          const field = tplFields.find((f) => f.code === key);
          if (!field) { resolvedData[key] = val; continue; }

          // Resolve master-data-select: label → UUID
          if (field.masterDataType && labelToIdMaps[field.masterDataType]) {
            const resolved = labelToIdMaps[field.masterDataType][strVal];
            resolvedData[key] = resolved || strVal;
            continue;
          }

          // Resolve static select: label → value
          if (field.options && selectLabelToValue[key]) {
            const resolved = selectLabelToValue[key][strVal.toLowerCase()];
            resolvedData[key] = resolved || strVal;
            continue;
          }

          // Boolean fields
          if (field.type === 'checkbox' || field.type === 'toggle') {
            resolvedData[key] = strVal.toLowerCase() === 'yes' || strVal === 'true' || strVal === '1';
            continue;
          }

          resolvedData[key] = val;
        }

        // Reconstruct admin-location objects from expanded columns
        for (const alf of adminLocationFields) {
          const loc: Record<string, string> = {};
          let hasLoc = false;
          for (const level of alf.levels || []) {
            const colKey = level === 0 ? `${alf.code}__country` : `${alf.code}__admin${level}`;
            const cellVal = String(resolvedData[colKey] || '').trim();
            if (cellVal) {
              if (level === 0) {
                // Resolve country name → code
                loc[`level_${level}`] = countryNameToCode[cellVal.toLowerCase()] || cellVal;
              } else {
                // For admin divisions, try to find GADM GID by name
                const gid = Object.entries(GADM_MAP).find(([, name]) => name.toLowerCase() === cellVal.toLowerCase())?.[0];
                loc[`level_${level}`] = gid || cellVal;
              }
              hasLoc = true;
            }
            delete resolvedData[colKey];
          }
          if (hasLoc) resolvedData[alf.code] = loc;
        }

        rows.push(resolvedData);
      }

      if (rows.length === 0) {
        setError(t('noDataRowsFound'));
        setImporting(false);
        return;
      }

      // Submit rows as form submissions
      let token = '';
      let tenantId = '';
      try {
        const raw = localStorage.getItem('aris-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          token = parsed?.state?.accessToken || '';
          tenantId = parsed?.state?.user?.tenantId || '';
        }
      } catch { /* ignore */ }

      let success = 0;
      let errors = 0;
      const errorMessages: string[] = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const promises = batch.map((rowData) =>
          fetch('/api/v1/collecte/submissions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
            },
            body: JSON.stringify({
              campaignId,
              formTemplateId: template.id,
              data: rowData,
              status: 'SUBMITTED',
            }),
          }).then(async (r) => {
            if (r.ok) {
              success++;
            } else {
              errors++;
              try {
                const body = await r.json();
                if (errorMessages.length < 3) errorMessages.push(body.message || `Row error: HTTP ${r.status}`);
              } catch { /* ignore */ }
            }
          }).catch(() => { errors++; }),
        );
        await Promise.all(promises);
      }

      if (errorMessages.length > 0) {
        console.warn('[Import] Sample errors:', errorMessages);
      }

      setResult({ success, errors, total: rows.length });
    } catch (err: any) {
      setError(err?.message || t('importFailed'));
    } finally {
      setImporting(false);
    }
  }, [file, campaignId, tplFields]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center gap-3 text-white">
            <Upload className="h-5 w-5" />
            <div>
              <h2 className="text-base font-semibold">{t('importData')}</h2>
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
            disabled={generating}
            className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10 p-4 text-left hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" /> : <FileDown className="h-8 w-8 text-emerald-500" />}
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {generating ? 'Generating template...' : t('downloadRefTemplate')}
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                {generating ? 'Fetching reference data and building dropdowns...' : t('generateTemplateDesc', { count: String(tplFields.length) })}
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
                  {t('remove')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dragDropExcel')}
                </p>
                <p className="text-xs text-gray-400">{t('or')}</p>
                <label className="cursor-pointer rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                  {t('browseFiles')}
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
                </label>
                <p className="mt-1 text-[10px] text-gray-400">{t('supportedFormats')}</p>
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
                <span className="text-sm font-medium text-gray-900 dark:text-white">{t('importComplete')}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{result.total}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t('totalRows')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{result.success}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t('success')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">{result.errors}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t('errors')}</p>
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
            {result ? t('close') : t('cancel')}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? t('importing') : t('importFormat', { format: file ? file.name.split('.').pop()?.toUpperCase() ?? '' : '' })}
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
