'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  Archive,
  Copy,
  Trash2,
  Eye,
  Edit3,
  SendHorizonal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Sliders,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFormBuilderTemplates,
  useDuplicateFormTemplate,
  useDeleteFormTemplate,
  usePublishFormTemplate,
  useArchiveFormTemplate,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ── Excel export ────────────────────────────────────────────────────────── */

interface SchemaSection {
  name?: { en?: string; fr?: string };
  order?: number;
  color?: string;
  fields?: SchemaField[];
}

interface SchemaField {
  code?: string;
  type?: string;
  label?: { en?: string; fr?: string };
  helpText?: { en?: string; fr?: string };
  required?: boolean;
  properties?: Record<string, unknown>;
  validation?: Record<string, unknown>;
}

interface SelectOpt {
  label?: { en?: string; fr?: string };
  value?: string;
}

function ml(t?: { en?: string; fr?: string }): string {
  return t?.en || t?.fr || '';
}

function getFieldTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    text: 'Text', textarea: 'Text (long)', number: 'Number', date: 'Date',
    select: 'Select', 'master-data-select': 'Select (ref)', 'multi-select': 'Multi-select',
    toggle: 'Yes / No', radio: 'Choice', checkbox: 'Checkbox', phone: 'Phone',
    email: 'Email', url: 'URL', 'geo-point': 'GPS', 'geo-selector': 'GPS',
    repeater: 'Repeater group',
  };
  return map[type || ''] || type || '';
}

function getFieldConstraints(field: SchemaField): string {
  const parts: string[] = [];
  if (field.required) parts.push('Required');
  const v = field.validation || {};
  if (v.min !== undefined) parts.push(`Min: ${v.min}`);
  if (v.max !== undefined) parts.push(`Max: ${v.max}`);
  if (v.maxLength) parts.push(`Max length: ${v.maxLength}`);
  const p = field.properties || {};
  if (p.min !== undefined) parts.push(`Min: ${p.min}`);
  if (p.max !== undefined) parts.push(`Max: ${p.max}`);
  return parts.join(', ');
}

function getFieldOptions(field: SchemaField): string {
  const opts = (field.properties?.options || []) as SelectOpt[];
  if (opts.length > 0) return opts.map((o) => ml(o.label) || o.value || '').join(' | ');
  const mdt = field.properties?.masterDataType;
  if (mdt) return `[Reference: ${mdt}]`;
  return '';
}

interface FlatField {
  section: string;
  sectionColor?: string;
  code: string;
  label: string;
  type: string;
  constraints: string;
  options: string;
  help: string;
  isRequired: boolean;
}

function flattenFields(sections: SchemaSection[]): FlatField[] {
  const rows: FlatField[] = [];
  const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const sec of sorted) {
    const sectionName = ml(sec.name);
    const sectionColor = sec.color;
    const fields = sec.fields || [];
    for (const f of fields) {
      if (f.type === 'repeater') {
        const subFields = (f.properties?.fields || []) as SchemaField[];
        const repeaterLabel = ml(f.label);
        for (const sf of subFields) {
          rows.push({
            section: sectionName, sectionColor,
            code: `${f.code}.${sf.code || ''}`,
            label: `${repeaterLabel} > ${ml(sf.label)}`,
            type: getFieldTypeLabel(sf.type),
            constraints: getFieldConstraints(sf),
            options: getFieldOptions(sf),
            help: ml(sf.helpText),
            isRequired: sf.required ?? false,
          });
        }
      } else if (f.type === 'admin-location') {
        const levels = (f.properties?.levels as number[]) || [0, 1, 2];
        const reqLevels = new Set((f.properties?.requiredLevels as number[]) || [0]);
        const adminFields = [
          { level: 0, code: 'country', label: 'Country', help: 'ISO country code (e.g. KE, ET, NG)' },
          { level: 1, code: 'admin1', label: 'Admin1', help: 'First administrative division (Region, Province, State...)' },
          { level: 2, code: 'admin2', label: 'Admin2', help: 'Second administrative division (District, Department, County...)' },
          { level: 3, code: 'admin3', label: 'Admin3', help: 'Third administrative division (Sub-district, Commune, Ward...)' },
        ];
        for (const af of adminFields) {
          if (!levels.includes(af.level)) continue;
          rows.push({
            section: sectionName, sectionColor,
            code: af.code, label: af.label, type: 'Select',
            constraints: reqLevels.has(af.level) ? 'Required' : '',
            options: af.level === 0 ? '[ISO 3166-1 alpha-2]' : '[Reference: administrative divisions]',
            help: af.help,
            isRequired: reqLevels.has(af.level),
          });
        }
      } else if (f.type === 'geo-selector' || f.type === 'geo-point') {
        rows.push({
          section: sectionName, sectionColor,
          code: f.code || '', label: ml(f.label), type: getFieldTypeLabel(f.type),
          constraints: f.required ? 'Required' : '', options: '', help: ml(f.helpText),
          isRequired: f.required ?? false,
        });
      } else {
        rows.push({
          section: sectionName, sectionColor,
          code: f.code || '', label: ml(f.label), type: getFieldTypeLabel(f.type),
          constraints: getFieldConstraints(f), options: getFieldOptions(f), help: ml(f.helpText),
          isRequired: f.required ?? false,
        });
      }
    }
  }
  return rows;
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const COLORS = {
  primary: '1B5E20',       // AU-IBAR green
  primaryLight: 'E8F5E9',
  headerBg: '1B5E20',
  headerFont: 'FFFFFF',
  sectionBg: 'F5F5F5',
  requiredBg: 'FFF3E0',
  requiredFont: 'E65100',
  borderColor: 'BDBDBD',
  lightBorder: 'E0E0E0',
  titleBg: '0D47A1',
  titleFont: 'FFFFFF',
  metaLabel: '616161',
  metaValue: '212121',
  instrBg: 'FFFDE7',
  instrBorder: 'FDD835',
  footerBg: 'ECEFF1',
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.lightBorder } },
  bottom: { style: 'thin', color: { argb: COLORS.lightBorder } },
  left: { style: 'thin', color: { argb: COLORS.lightBorder } },
  right: { style: 'thin', color: { argb: COLORS.lightBorder } },
};

const mediumBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.borderColor } },
  bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
  left: { style: 'thin', color: { argb: COLORS.borderColor } },
  right: { style: 'thin', color: { argb: COLORS.borderColor } },
};

async function exportFormToExcel(template: FormTemplateListItem) {
  const schema = template.schema as { sections?: SchemaSection[] } | undefined;
  const sections = schema?.sections || [];
  const fields = flattenFields(sections);
  const domainLabel = DOMAIN_OPTIONS.find((d) => d.value === template.domain)?.label || template.domain;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ARIS 4.0 — AU-IBAR';
  wb.created = new Date();

  // ═══════════════════════════════════════════════════════════════════════
  // Sheet 1: Data Entry
  // ═══════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Data Entry', {
    properties: { defaultColWidth: 20 },
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // Row 1: Section name row — merge consecutive columns with the same section
  const secRow = ws1.addRow(fields.map(() => ''));
  secRow.height = 24;

  // Build merge ranges: [{start, end, name, color}]
  const mergeRanges: Array<{ start: number; end: number; name: string; color: string }> = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const last = mergeRanges[mergeRanges.length - 1];
    if (last && last.name === f.section) {
      last.end = i;
    } else {
      mergeRanges.push({ start: i, end: i, name: f.section, color: f.sectionColor?.replace('#', '') || COLORS.primary });
    }
  }

  for (const range of mergeRanges) {
    const startCol = range.start + 1; // 1-based
    const endCol = range.end + 1;
    if (startCol < endCol) {
      ws1.mergeCells(1, startCol, 1, endCol);
    }
    const cell = secRow.getCell(startCol);
    cell.value = range.name;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: range.color } };
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = mediumBorder;
  }

  // Row 2: Field label headers
  const headerRow = ws1.addRow(fields.map((f) => f.isRequired ? `${f.label} *` : f.label));
  headerRow.height = 30;
  headerRow.eachCell((cell, colNum) => {
    const f = fields[colNum - 1];
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: f?.isRequired ? COLORS.requiredBg : COLORS.primaryLight },
    };
    cell.font = {
      bold: true, size: 10,
      color: { argb: f?.isRequired ? COLORS.requiredFont : COLORS.primary },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = mediumBorder;
  });

  // Set column widths based on label length
  fields.forEach((f, i) => {
    const col = ws1.getColumn(i + 1);
    col.width = Math.max(f.label.length + 6, 18);
  });

  // Add 50 empty rows with alternating stripes and borders
  for (let r = 0; r < 50; r++) {
    const row = ws1.addRow(fields.map(() => ''));
    row.height = 20;
    row.eachCell((cell) => {
      cell.border = thinBorder;
      if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FAFAFA' } };
      }
      cell.alignment = { vertical: 'middle' };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Sheet 2: Field Dictionary
  // ═══════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Field Dictionary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const dictHeaders = ['#', 'Section', 'Field Code', 'Field Label', 'Type', 'Constraints', 'Allowed Values', 'Description'];
  const dictWidths = [5, 24, 26, 34, 14, 18, 40, 48];

  // Header row
  const dh = ws2.addRow(dictHeaders);
  dh.height = 28;
  dh.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = { bold: true, size: 10, color: { argb: COLORS.headerFont } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = mediumBorder;
  });

  dictWidths.forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  // Data rows with section grouping
  let prevSection = '';
  fields.forEach((f, idx) => {
    const isNewSection = f.section !== prevSection;
    prevSection = f.section;

    // Section separator row
    if (isNewSection) {
      const sepRow = ws2.addRow([]);
      const sepCell = sepRow.getCell(1);
      ws2.mergeCells(sepRow.number, 1, sepRow.number, dictHeaders.length);
      sepCell.value = f.section;
      sepCell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: f.sectionColor?.replace('#', '') || 'E0E0E0' },
      };
      sepCell.font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
      sepCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      sepCell.border = mediumBorder;
      sepRow.height = 24;
    }

    const row = ws2.addRow([idx + 1, f.section, f.code, f.label, f.type, f.constraints, f.options, f.help]);
    row.height = 22;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: colNum >= 7 };
      cell.font = { size: 10 };

      // Required fields highlight
      if (f.isRequired && colNum === 6) {
        cell.font = { size: 10, bold: true, color: { argb: COLORS.requiredFont } };
      }
      // Field label column bold
      if (colNum === 4) {
        cell.font = { size: 10, bold: true };
      }
    });

    // Alternate row color
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9F9F9' } };
      });
    }
  });

  // Auto-filter
  ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: dictHeaders.length } };

  // ═══════════════════════════════════════════════════════════════════════
  // Sheet 3: Instructions
  // ═══════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('Instructions');
  ws3.getColumn(1).width = 22;
  ws3.getColumn(2).width = 80;

  // Title
  const titleRow = ws3.addRow(['ARIS 4.0 — Form Template Reference']);
  ws3.mergeCells(1, 1, 1, 2);
  titleRow.height = 40;
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: COLORS.titleFont } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  ws3.addRow([]);

  // Metadata
  const metaItems = [
    ['Form Name', template.name],
    ['Domain', domainLabel],
    ['Version', `v${template.version}`],
    ['Sections', String(sections.length)],
    ['Fields', String(fields.length)],
    ['Exported', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })],
  ];
  for (const [label, value] of metaItems) {
    const row = ws3.addRow([label, value]);
    row.height = 22;
    row.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.metaLabel } };
    row.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(2).font = { size: 11, color: { argb: COLORS.metaValue } };
    row.getCell(2).alignment = { vertical: 'middle' };
    row.getCell(1).border = { bottom: { style: 'dotted', color: { argb: 'E0E0E0' } } };
    row.getCell(2).border = { bottom: { style: 'dotted', color: { argb: 'E0E0E0' } } };
  }

  ws3.addRow([]);

  // Instructions header
  const instrHdr = ws3.addRow(['Instructions']);
  ws3.mergeCells(instrHdr.number, 1, instrHdr.number, 2);
  instrHdr.height = 28;
  instrHdr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
  instrHdr.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  instrHdr.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const instructions = [
    'Use the "Data Entry" sheet to fill in your data. Each column corresponds to a form field.',
    'Refer to the "Field Dictionary" sheet for detailed field descriptions, types, and allowed values.',
    'Columns marked with * (orange headers) are required and must be filled.',
    'For select fields, use only the values listed in the "Allowed Values" column of the dictionary.',
    'For reference selects (e.g., [Reference: species]), use official codes from the ARIS system.',
    'Date format: YYYY-MM-DD (e.g., 2025-03-15).',
    'Repeater fields (e.g., "Animals by Species > Number of Cases") use one row per entry.',
    'Once completed, this file can be imported into the ARIS platform via Collecte > Import.',
  ];

  instructions.forEach((text, i) => {
    const row = ws3.addRow([`${i + 1}.`, text]);
    ws3.mergeCells(row.number, 2, row.number, 2);
    row.height = 24;
    row.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.primary } };
    row.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(2).font = { size: 10 };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
    if (i % 2 === 0) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.instrBg } };
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.instrBg } };
    }
  });

  ws3.addRow([]);

  // Footer
  const footerRow = ws3.addRow(['', 'Generated by ARIS 4.0 Form Builder — African Union Inter-African Bureau for Animal Resources (AU-IBAR)']);
  ws3.mergeCells(footerRow.number, 1, footerRow.number, 2);
  footerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.footerBg } };
  footerRow.getCell(1).font = { italic: true, size: 9, color: { argb: '757575' } };
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  footerRow.height = 28;

  // ── Download ──────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `ARIS_${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${template.version}.xlsx`;
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  PUBLISHED: { label: 'Published', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  ARCHIVED: { label: 'Archived', color: 'bg-gray-100 text-gray-500', icon: <Archive className="h-3 w-3" /> },
};

export default function FormListPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useFormBuilderTemplates({
    page,
    limit: 10,
    status: statusFilter || undefined,
    domain: domainFilter || undefined,
  });

  const userRole = useAuthStore((s) => s.user?.role);
  const canCustomize = userRole === 'REC_ADMIN' || userRole === 'NATIONAL_ADMIN';

  const duplicateMutation = useDuplicateFormTemplate();
  const deleteMutation = useDeleteFormTemplate();
  const publishMutation = usePublishFormTemplate();
  const archiveMutation = useArchiveFormTemplate();

  const templates = data?.data ?? [];
  const meta = data?.meta;

  // Client-side search filter
  const filtered = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.domain.toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/collecte"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            title="Back to Collecte"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Form Builder</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create and manage no-code data collection forms
            </p>
          </div>
        </div>
        <Link
          href="/collecte/forms/new"
          className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Form
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={domainFilter}
            onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All domains</option>
            {DOMAIN_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Form List */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filtered.map((template) => (
            <FormCard
              key={template.id}
              template={template}
              onDuplicate={() => duplicateMutation.mutate(template.id)}
              onDelete={() => {
                if (confirm('Delete this draft form?')) deleteMutation.mutate(template.id);
              }}
              onPublish={() => publishMutation.mutate(template.id)}
              onArchive={() => archiveMutation.mutate(template.id)}
              canCustomize={canCustomize}
            />
          ))}

          {/* Pagination */}
          {meta && meta.total > meta.limit && (
            <Pagination
              page={meta.page}
              total={meta.total}
              limit={meta.limit}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FormCard({
  template,
  onDuplicate,
  onDelete,
  onPublish,
  onArchive,
  canCustomize,
}: {
  template: FormTemplateListItem;
  onDuplicate: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onArchive: () => void;
  canCustomize?: boolean;
}) {
  const statusCfg = STATUS_CONFIG[template.status] || STATUS_CONFIG.DRAFT;
  const domainLabel = DOMAIN_OPTIONS.find((d) => d.value === template.domain)?.label || template.domain;

  // Count fields from schema
  let fieldCount = 0;
  let sectionCount = 0;
  try {
    const schema = template.schema as { sections?: Array<{ fields?: unknown[] }> };
    sectionCount = schema?.sections?.length || 0;
    fieldCount = schema?.sections?.reduce((sum, s) => sum + (s.fields?.length || 0), 0) || 0;
  } catch { /* ignore */ }

  const handleExportExcel = useCallback(() => {
    exportFormToExcel(template);
  }, [template]);

  const actionBtn =
    'rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {template.name}
            </h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', statusCfg.color)}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400">
              {domainLabel}
            </span>
            <span>v{template.version}</span>
            <span>{sectionCount} sections</span>
            <span>{fieldCount} fields</span>
            <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 ml-4">
          <Link href={`/collecte/forms/${template.id}/preview`} className={actionBtn} title="Preview">
            <Eye className="h-4 w-4" />
          </Link>
          {template.status === 'DRAFT' && (
            <Link href={`/collecte/forms/${template.id}/edit`} className={actionBtn} title="Edit">
              <Edit3 className="h-4 w-4" />
            </Link>
          )}
          <button onClick={onDuplicate} className={actionBtn} title="Duplicate">
            <Copy className="h-4 w-4" />
          </button>
          {template.status === 'DRAFT' && (
            <button onClick={onPublish} className={actionBtn} title="Publish">
              <SendHorizonal className="h-4 w-4" />
            </button>
          )}
          {template.status === 'PUBLISHED' && canCustomize && (
            <Link
              href={`/collecte/forms/${template.id}/customize`}
              className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 transition-colors"
              title="Customize for your tenant"
            >
              <Sliders className="h-4 w-4" />
            </Link>
          )}
          {template.status === 'PUBLISHED' && (
            <button onClick={onArchive} className={actionBtn} title="Archive">
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30 transition-colors"
            title="Export Excel template"
          >
            <Download className="h-4 w-4" />
          </button>
          {template.status === 'DRAFT' && (
            <button
              onClick={() => { if (confirm('Delete this draft form?')) onDelete(); }}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Modern Pagination ───────────────────────────────────────────────────── */

function Pagination({
  page,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // Build visible page numbers (always show first, last, current ± 1)
  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  const btnBase =
    'inline-flex items-center justify-center h-9 min-w-[36px] rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-aris-primary-500/30';
  const btnNav = cn(btnBase, 'px-2 border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800');
  const btnPage = (active: boolean) =>
    cn(
      btnBase,
      'px-3',
      active
        ? 'bg-aris-primary-600 text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
    );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{from}–{to}</span> of{' '}
        <span className="font-semibold text-gray-700 dark:text-gray-300">{total}</span> forms
      </p>

      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className={btnNav}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={btnNav}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1 text-gray-400 select-none">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={btnPage(p === page)}
            >
              {p}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={btnNav}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className={btnNav}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
      <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
      <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No forms yet</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Create your first data collection form using the no-code builder.
      </p>
      <Link
        href="/collecte/forms/new"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700"
      >
        <Plus className="h-4 w-4" />
        Create Form
      </Link>
    </div>
  );
}
