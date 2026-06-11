'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Download, FileSpreadsheet, Filter, Loader2, AlertCircle,
  Eye, Table2, X, Calendar, User, Hash, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { COUNTRIES } from '@/data/countries-config';
import { ADMIN_DIVISIONS } from '@/data/admin-divisions';

// ── Helpers ──

function tplName(name: unknown): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') { const o = name as Record<string, string>; return o.en ?? o.fr ?? Object.values(o)[0] ?? ''; }
  return String(name);
}

interface Field {
  code: string;
  label: string;
  type: string;
  masterDataType?: string;
  options?: { label: string; value: string }[];
  searchable?: boolean;
}

function extractFields(schema: unknown): Field[] {
  const s = schema as { sections?: { fields?: any[] }[] } | null;
  if (!s?.sections) return [];
  const rows: Field[] = [];
  for (const sec of s.sections) {
    for (const f of sec.fields || []) {
      if (f.code && !f.hidden && !['heading', 'divider', 'spacer', 'info-box'].includes(f.type || '')) {
        const props = f.properties || {};
        const opts = (props.options || []).map((o: any) => ({
          label: o.label?.en || o.label?.fr || o.value || '',
          value: o.value || '',
        }));
        rows.push({
          code: f.code,
          label: f.label?.en || f.label?.fr || f.code,
          type: f.type || 'text',
          masterDataType: props.masterDataType || props.referenceType || undefined,
          options: opts.length > 0 ? opts : undefined,
          searchable: f.searchable === true || props.searchable === true,
        });
      }
    }
  }
  return rows;
}

// Country code → name map from config
const COUNTRY_MAP: Record<string, string> = {};
for (const [code, c] of Object.entries(COUNTRIES)) {
  COUNTRY_MAP[code.toUpperCase()] = c.name;
  COUNTRY_MAP[code.toLowerCase()] = c.name;
}

// GADM gid → name map for admin divisions (admin1 + admin2)
const GADM_MAP: Record<string, string> = {};
for (const [, countryData] of Object.entries(ADMIN_DIVISIONS)) {
  for (const a1 of countryData.admin1 || []) {
    GADM_MAP[a1.gid] = a1.name;
  }
  for (const a2 of countryData.admin2 || []) {
    GADM_MAP[a2.gid] = a2.name;
  }
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

/** Fetch ref-data for a master-data-select type → returns id→label map */
async function fetchRefData(type: string): Promise<Record<string, string>> {
  const token = useAuthStore.getState().accessToken || '';
  try {
    const res = await fetch(`/api/v1/master-data/ref/${type}/for-select?limit=500`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, string> = {};
    for (const item of json?.data || []) {
      if (!item.id) continue;
      // API returns { id, code, name: { en, fr, pt, ar } } or { id, label }
      const name = item.name;
      let label = item.label || '';
      if (!label && name) {
        if (typeof name === 'string') label = name;
        else if (typeof name === 'object') label = name.en || name.fr || name.pt || Object.values(name).find((v: any) => v) || '';
      }
      if (!label) label = item.code || '';
      if (label) map[item.id] = label;
    }
    return map;
  } catch {
    return {};
  }
}

// UUID regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Friendly labels for common repeater sub-fields
const FIELD_LABELS: Record<string, string> = {
  species: 'Species', sex: 'Sex', age_group: 'Age Group', breed: 'Breed',
  num_cases: 'Cases', num_deaths: 'Deaths', num_at_risk: 'At Risk',
  num_destroyed: 'Destroyed', num_vaccinated: 'Vaccinated', num_slaughtered: 'Slaughtered',
  num_susceptible: 'Susceptible', measure: 'Measure', flag: 'Applied',
  epi_unit_type: 'Epi. Unit Type', locality_name: 'Locality', production_system: 'Production System',
  vaccine_type: 'Vaccine Type', num_doses: 'Doses', date_start: 'Start Date', date_end: 'End Date',
  body_part: 'Body Part', sample_type: 'Sample Type', test_type: 'Test Type', result: 'Result',
  lab: 'Laboratory', diagnosis_basis: 'Diagnosis Basis', causal_agent: 'Causal Agent',
};

/** Format a cell value, resolving UUIDs via refMap */
function formatCell(val: unknown, field: Field, refMap: Record<string, string>): string {
  if (val === null || val === undefined || val === '') return '-';

  // Admin location object — resolve GADM gids to names
  if (field.type === 'admin-location' && typeof val === 'object' && !Array.isArray(val)) {
    const loc = val as Record<string, string>;
    const country = COUNTRY_MAP[loc.level_0] || loc.level_0 || '';
    const admin1 = GADM_MAP[loc.level_1] || loc.level_1 || '';
    const admin2 = GADM_MAP[loc.level_2] || loc.level_2 || '';
    const admin3 = GADM_MAP[loc.level_3] || loc.level_3 || '';
    const parts = [country, admin1, admin2, admin3].filter(Boolean);
    return parts.join(' / ') || '-';
  }

  // Geo coordinates
  if (field.type === 'geo-selector' && typeof val === 'object' && !Array.isArray(val)) {
    const geo = val as { lat?: number; lng?: number };
    if (geo.lat && geo.lng) return `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`;
    return '-';
  }

  // Select with options — resolve value to label
  if (field.options && typeof val === 'string') {
    const opt = field.options.find((o) => o.value === val);
    if (opt) return opt.label;
  }

  // UUID → try refMap
  if (typeof val === 'string' && UUID_RE.test(val)) {
    return refMap[val] || val.slice(0, 8) + '...';
  }

  // Array of objects (repeaters, control measures, etc.)
  if (Array.isArray(val)) {
    if (val.length === 0) return '-';
    // Array of UUIDs
    if (typeof val[0] === 'string') {
      return val.map((v) => UUID_RE.test(v) ? (refMap[v] || v.slice(0, 8) + '...') : v).join(', ');
    }
    // Array of objects — show count
    return `${val.length} item(s)`;
  }

  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/** Format a value for the detail panel (more verbose) */
function formatDetail(val: unknown, field: Field, refMap: Record<string, string>): React.ReactNode {
  if (val === null || val === undefined || val === '') return '-';

  // Admin location — resolve GADM gids to names
  if (field.type === 'admin-location' && typeof val === 'object' && !Array.isArray(val)) {
    const loc = val as Record<string, string>;
    const country = COUNTRY_MAP[loc.level_0] || loc.level_0;
    const parts: string[] = [];
    if (country) parts.push(country);
    if (loc.level_1) parts.push(GADM_MAP[loc.level_1] || loc.level_1);
    if (loc.level_2) parts.push(GADM_MAP[loc.level_2] || loc.level_2);
    if (loc.level_3) parts.push(GADM_MAP[loc.level_3] || loc.level_3);
    return (
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        {parts.join(' / ') || '-'}
      </span>
    );
  }

  // Geo coordinates
  if (field.type === 'geo-selector' && typeof val === 'object' && !Array.isArray(val)) {
    const geo = val as { lat?: number; lng?: number };
    if (geo.lat && geo.lng) return `${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`;
    return '-';
  }

  // Select option
  if (field.options && typeof val === 'string') {
    const opt = field.options.find((o) => o.value === val);
    if (opt) return opt.label;
  }

  // UUID
  if (typeof val === 'string' && UUID_RE.test(val)) {
    const resolved = refMap[val];
    return resolved || val;
  }

  // Array of objects (repeater rows: animals, control measures, locations)
  if (Array.isArray(val)) {
    if (val.length === 0) return '-';
    return (
      <div className="space-y-2">
        {val.map((item, i) => (
          <div key={i} className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
            {typeof item === 'object' ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(item as Record<string, unknown>).map(([k, v]) => {
                  const label = FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  let display: string;
                  if (typeof v === 'string' && UUID_RE.test(v)) {
                    display = refMap[v] || v.slice(0, 12) + '...';
                  } else if (typeof v === 'boolean') {
                    display = v ? 'Yes' : 'No';
                  } else {
                    display = String(v ?? '-');
                  }
                  return (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">{label}</span>
                      <span className="text-xs text-gray-800 dark:text-gray-200">{display}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-gray-700">
                {UUID_RE.test(String(item)) ? (refMap[String(item)] || String(item)) : String(item)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
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
  submission, fields, refMap, onClose,
}: {
  submission: any; fields: Field[]; refMap: Record<string, string>; onClose: () => void;
}) {
  const t = useTranslations('collecte');
  const rowData = submission?.data || {};

  // Lock body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Use portal to render above everything (sidebar z-50, header z-50)
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {/* Full-screen backdrop — covers sidebar + header */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 99998 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>
      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200"
        style={{ zIndex: 99999 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('submissionDetail') || 'Submission Detail'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">ID: {submission.id?.slice(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '-'}
            </div>
            <span className={cn(
              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
              submission.status === 'SUBMITTED' && 'bg-blue-100 text-blue-700',
              submission.status === 'VALIDATED' && 'bg-green-100 text-green-700',
              submission.status === 'REJECTED' && 'bg-red-100 text-red-700',
              !['SUBMITTED', 'VALIDATED', 'REJECTED'].includes(submission.status) && 'bg-gray-100 text-gray-600',
            )}>
              {submission.status}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 space-y-1">
          {fields.map((field) => {
            const val = rowData[field.code];
            if (val === undefined || val === null || val === '') return null;
            return (
              <div key={field.code} className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-36 shrink-0 pt-0.5 uppercase tracking-wide">{field.label}</span>
                <div className="text-sm text-gray-900 dark:text-white break-words min-w-0">{formatDetail(val, field, refMap)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
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

  const [viewData, setViewData] = useState<any[] | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTotal, setViewTotal] = useState(0);
  const [viewPage, setViewPage] = useState(1);
  const [viewPageSize, setViewPageSize] = useState(20);
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [refMap, setRefMap] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [viewFilters, setViewFilters] = useState<Record<string, string>>({});

  // Load reference data for master-data-select fields
  const [refFetched, setRefFetched] = useState(false);
  useEffect(() => {
    if (fields.length > 0 && !refFetched) {
      setRefFetched(true);
      const mdTypes = new Set<string>();
      for (const f of fields) {
        if (f.type === 'master-data-select' && f.masterDataType) {
          mdTypes.add(f.masterDataType);
        }
      }
      // Always fetch common reference types
      mdTypes.add('diseases');
      mdTypes.add('species');
      mdTypes.add('outbreak-statuses');
      mdTypes.add('diagnosis-bases');
      mdTypes.add('source-of-infections');
      mdTypes.add('control-measures');
      mdTypes.add('animal-sexes');
      mdTypes.add('epidemiological-unit-types');
      mdTypes.add('vaccine-types');
      mdTypes.add('breeds');
      mdTypes.add('age-groups');
      mdTypes.add('production-systems');
      mdTypes.add('sample-types');
      mdTypes.add('test-types');
      mdTypes.add('labs');
      mdTypes.add('gear-types');
      mdTypes.add('commodities');
      mdTypes.add('species-groups');
      mdTypes.add('clinical-signs');
      mdTypes.add('body-parts');
      mdTypes.add('causal-agent-types');
      mdTypes.add('notification-reasons');
      mdTypes.add('transport-modes');
      mdTypes.add('animal-husbandries');
      mdTypes.add('genetic-diversities');

      Promise.all(
        [...mdTypes].map((type) => fetchRefData(type)),
      ).then((maps) => {
        const merged: Record<string, string> = {};
        for (const m of maps) Object.assign(merged, m);
        setRefMap(merged);
      });
    }
  }, [fields, refFetched]);

  // Fetch submissions for current page (server-side pagination)
  const fetchPage = useCallback(async (page: number, limit: number) => {
    setViewLoading(true);
    setError('');
    try {
      const token = useAuthStore.getState().accessToken || '';
      const res = await fetch(
        `/api/v1/collecte/submissions?campaign=${campaignId}&limit=${limit}&page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setViewData(json?.data || []);
      setViewTotal(json?.meta?.total ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load submissions');
    } finally {
      setViewLoading(false);
    }
  }, [campaignId]);

  // Auto-load on view mode, page change, or page size change
  useEffect(() => {
    if (isViewMode) {
      fetchPage(viewPage, viewPageSize);
    }
  }, [isViewMode, viewPage, viewPageSize, fetchPage]);

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

  // Filter fields: built-in (country, date) + schema searchable fields + auto-detected select/text
  const viewFilterFields = useMemo(() => {
    const builtIn: Field[] = [
      { code: '_country', label: 'Country', type: 'text', searchable: true },
      { code: '_date', label: 'Date', type: 'date', searchable: true },
    ];
    // Fields marked searchable in schema
    const marked = fields.filter((f) => f.searchable);
    // Auto-detect: select and key text fields (first few), skip complex types
    const auto = fields.filter((f) =>
      !f.searchable && ['select', 'text', 'master-data-select'].includes(f.type) &&
      !['geo-selector', 'repeater', 'matrix', 'admin-location'].includes(f.type),
    ).slice(0, 4);
    // Deduplicate by code
    const seen = new Set<string>();
    const result: Field[] = [];
    for (const f of [...builtIn, ...marked, ...auto]) {
      if (!seen.has(f.code)) { seen.add(f.code); result.push(f); }
    }
    return result.slice(0, 8);
  }, [fields]);

  // Apply client-side filters to viewData
  const filteredViewData = useMemo(() => {
    if (!viewData) return null;
    const activeFilters = Object.entries(viewFilters).filter(([, v]) => v.trim());
    if (activeFilters.length === 0) return viewData;
    return viewData.filter((sub) => {
      const d = sub.data || {};
      return activeFilters.every(([key, val]) => {
        const needle = val.toLowerCase();
        if (key === '_country') {
          const code = d.adm0 || d.country || '';
          const country = COUNTRIES.find((c: any) => c.code === code);
          const searchStr = `${code} ${country?.name || ''} ${country?.nameFr || ''}`.toLowerCase();
          return searchStr.includes(needle);
        }
        if (key === '_date') {
          const dateStr = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '';
          return dateStr.includes(needle);
        }
        const cellVal = String(d[key] ?? '').toLowerCase();
        // Also check refMap for UUID resolution
        const resolved = refMap[d[key]] || '';
        return cellVal.includes(needle) || resolved.toLowerCase().includes(needle);
      });
    });
  }, [viewData, viewFilters, refMap]);

  // Compact summary: 4 most meaningful fields
  const summaryFields = useMemo(() => {
    // Prefer: admin_location first, then text/select fields, skip arrays/objects
    const priority = fields.filter((f) => f.type === 'admin-location');
    const rest = fields.filter((f) =>
      f.type !== 'admin-location' && !['geo-selector', 'repeater', 'matrix'].includes(f.type),
    );
    return [...priority, ...rest].slice(0, 4);
  }, [fields]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── VIEW MODE ── */}
      {isViewMode && (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Table2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">{name || t('loading')}</h1>
                  <p className="text-xs text-gray-500">{viewTotal} {t('submissions') || 'submission(s)'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowFilters((p) => !p)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    showFilters
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400',
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {showFilters ? 'Hide filters' : 'Filters'}
                  {Object.values(viewFilters).some((v) => v.trim()) && (
                    <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                      {Object.values(viewFilters).filter((v) => v.trim()).length}
                    </span>
                  )}
                </button>
                <Link href={`/collecte/campaigns/${campaignId}/export/${templateId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                  <Download className="h-3.5 w-3.5" /> {t('export')}
                </Link>
                <Link href={`/collecte/campaigns/${campaignId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <ArrowLeft className="h-3.5 w-3.5" /> {t('backToCampaign')}
                </Link>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                {viewFilterFields.map((f) => (
                  <div key={f.code} className="flex items-center gap-1.5 min-w-0">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{f.label}</label>
                    {f.options && f.options.length > 0 ? (
                      <select
                        value={viewFilters[f.code] || ''}
                        onChange={(e) => setViewFilters((p) => ({ ...p, [f.code]: e.target.value }))}
                        className="h-7 w-[140px] rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        <option value="">All</option>
                        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : 'text'}
                        placeholder={f.type === 'date' ? '' : `Search...`}
                        value={viewFilters[f.code] || ''}
                        onChange={(e) => setViewFilters((p) => ({ ...p, [f.code]: e.target.value }))}
                        className="h-7 w-[130px] rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 placeholder:text-gray-300 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:placeholder:text-gray-600"
                      />
                    )}
                  </div>
                ))}
                {Object.values(viewFilters).some((v) => v.trim()) && (
                  <button
                    onClick={() => setViewFilters({})}
                    className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            {viewLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            {error && (
              <div className="m-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" /><p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            {filteredViewData && filteredViewData.length === 0 && !viewLoading && (
              <div className="text-center py-16">
                <Table2 className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  {Object.values(viewFilters).some((v) => v.trim())
                    ? 'No results match the current filters'
                    : (t('noSubmissionsYet') || 'No submissions yet.')}
                </p>
                {Object.values(viewFilters).some((v) => v.trim()) && (
                  <button onClick={() => setViewFilters({})} className="mt-2 text-xs text-emerald-600 hover:underline">Clear filters</button>
                )}
              </div>
            )}
            {filteredViewData && filteredViewData.length > 0 && (
              <div>
                {/* Filtered count indicator */}
                {Object.values(viewFilters).some((v) => v.trim()) && (
                  <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 text-xs text-gray-500">
                    Showing {filteredViewData.length} of {viewData?.length ?? 0} submissions
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-10"><Hash className="h-3.5 w-3.5" /></th>
                      {summaryFields.map((f) => (
                        <th key={f.code} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{f.label}</th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">{t('status') || 'Status'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-28">{t('date') || 'Date'}</th>
                      <th className="px-4 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredViewData.map((sub, idx) => {
                      const rowData = sub.data || {};
                      const globalIdx = (viewPage - 1) * viewPageSize + idx;
                      return (
                        <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => setSelectedSub(sub)}>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{globalIdx + 1}</td>
                          {summaryFields.map((f) => (
                            <td key={f.code} className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm truncate max-w-[200px]">
                              {formatCell(rowData[f.code], f, refMap)}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              sub.status === 'SUBMITTED' && 'bg-blue-100 text-blue-700',
                              sub.status === 'VALIDATED' && 'bg-green-100 text-green-700',
                              sub.status === 'REJECTED' && 'bg-red-100 text-red-700',
                              !['SUBMITTED', 'VALIDATED', 'REJECTED'].includes(sub.status) && 'bg-gray-100 text-gray-600',
                            )}>{sub.status}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedSub(sub); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                              <Eye className="h-3 w-3" /> View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Pagination */}
                {viewTotal > 0 && (() => {
                  const totalPages = Math.ceil(viewTotal / viewPageSize);
                  const from = (viewPage - 1) * viewPageSize + 1;
                  const to = Math.min(viewPage * viewPageSize, viewTotal);

                  // Build page numbers to show
                  const pages: (number | 'dots')[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (viewPage > 3) pages.push('dots');
                    for (let i = Math.max(2, viewPage - 1); i <= Math.min(totalPages - 1, viewPage + 1); i++) pages.push(i);
                    if (viewPage < totalPages - 2) pages.push('dots');
                    pages.push(totalPages);
                  }

                  return (
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500">Rows</label>
                          <select
                            value={viewPageSize}
                            onChange={(e) => { setViewPageSize(Number(e.target.value)); setViewPage(1); }}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            {PAGE_SIZE_OPTIONS.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of <span className="font-medium">{viewTotal}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewPage((p) => Math.max(1, p - 1))}
                          disabled={viewPage === 1}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          Previous
                        </button>
                        {pages.map((p, i) =>
                          p === 'dots' ? (
                            <span key={`dots-${i}`} className="px-1 text-gray-400 text-xs">...</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setViewPage(p)}
                              className={cn(
                                'min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                                p === viewPage
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                              )}
                            >
                              {p}
                            </button>
                          ),
                        )}
                        <button
                          onClick={() => setViewPage((p) => Math.min(totalPages, p + 1))}
                          disabled={viewPage === totalPages}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {selectedSub && <DetailPanel submission={selectedSub} fields={fields} refMap={refMap} onClose={() => setSelectedSub(null)} />}
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
                <div><h1 className="text-lg font-semibold">{t('exportData')}</h1><p className="text-sm text-blue-100">{name || t('loading')}</p></div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase">{t('format')}</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {(['xlsx', 'csv', 'json'] as const).map((f) => (
                    <button key={f} onClick={() => setFormat(f)} className={cn('flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all', format === f ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                      <FileSpreadsheet className="h-6 w-6" />{f.toUpperCase()}
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
