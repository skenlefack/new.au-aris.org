'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Filter,
  RotateCcw,
  Eye,
  AlertTriangle,
  Shield,
  X,
  ArrowRight,
  FileText,
  MapPin,
  Calendar,
  User,
  Tag,
  Globe,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkflowItems,
  useWorkflowAction,
  useWorkflowDashboard,
  useWorkflowDetail,
  type WorkflowItem,
  type WorkflowLevel,
  type WorkflowStatus,
  type SubmissionRecord,
} from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

/* ── Constants ────────────────────────────────────────────────────────────── */

const LEVEL_CONFIG: Record<WorkflowLevel, { label: string; shortLabel: string; dot: string; color: string }> = {
  NATIONAL_TECHNICAL:       { label: 'level1', shortLabel: 'L1', dot: 'bg-blue-500',   color: 'text-blue-700 dark:text-blue-400' },
  NATIONAL_OFFICIAL:        { label: 'level2', shortLabel: 'L2', dot: 'bg-green-500',  color: 'text-green-700 dark:text-green-400' },
  REC_HARMONIZATION:        { label: 'level3', shortLabel: 'L3', dot: 'bg-orange-500', color: 'text-orange-700 dark:text-orange-400' },
  CONTINENTAL_PUBLICATION:  { label: 'level4', shortLabel: 'L4', dot: 'bg-purple-500', color: 'text-purple-700 dark:text-purple-400' },
};

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  PENDING:    { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  IN_REVIEW:  { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
  APPROVED:   { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  REJECTED:   { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  RETURNED:   { bg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500' },
  ESCALATED:  { bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dot: 'bg-purple-500' },
  SUBMITTED:  { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  VALIDATED:  { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  VALIDATING: { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
  DRAFT:      { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
};

const DOMAIN_LABELS: Record<string, string> = {
  animal_health: 'Animal Health', livestock: 'Livestock', fisheries: 'Fisheries',
  wildlife: 'Wildlife', apiculture: 'Apiculture', trade: 'Trade & SPS',
  governance: 'Governance', climate: 'Climate & Env', collecte: 'Collecte',
};

const DOMAIN_COLORS: Record<string, string> = {
  animal_health: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  livestock: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fisheries: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  wildlife: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  apiculture: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  trade: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  governance: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  climate: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const ALL_LEVELS: WorkflowLevel[] = ['NATIONAL_TECHNICAL', 'NATIONAL_OFFICIAL', 'REC_HARMONIZATION', 'CONTINENTAL_PUBLICATION'];
const ALL_WF_STATUSES: WorkflowStatus[] = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'ESCALATED'];
const ALL_SUB_STATUSES = ['SUBMITTED', 'VALIDATED', 'REJECTED', 'DRAFT'];

const PAGE_SIZE = 20;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso?.slice(0, 10) ?? '--'; }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso?.slice(0, 16) ?? '--'; }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function localizeName(name: unknown): string {
  if (!name) return '--';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') {
    const n = name as Record<string, string>;
    return n.en || n.fr || n.pt || n.ar || Object.values(n).find((v) => v) || '--';
  }
  return String(name);
}

/** Detect if a value looks like a UUID */
function isUuid(v: unknown): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Detect if a value looks like an ISO date */
function isIsoDate(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s)/.test(v);
}

/** Format a field label from snake_case to Title Case */
function fieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Status Badge ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', s.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {statusLabel(status)}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Submission Detail Modal — Modern Design                              ── */
/* ══════════════════════════════════════════════════════════════════════════ */

function SubmissionDetailModal({ item, onClose, t }: {
  item: SubmissionRecord & { campaignName?: unknown; domain?: string };
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ info: true, data: true });
  const toggle = (s: string) => setExpandedSections((prev) => ({ ...prev, [s]: !prev[s] }));

  const data = item.data ?? {};
  const campaignName = localizeName((item as any).campaignName);
  const domain = (item as any).domain as string | undefined;

  // Categorize fields
  const dateFields: [string, unknown][] = [];
  const locationFields: [string, unknown][] = [];
  const referenceFields: [string, unknown][] = [];
  const countFields: [string, unknown][] = [];
  const otherFields: [string, unknown][] = [];
  const metaFields: [string, unknown][] = [];

  Object.entries(data).forEach(([key, val]) => {
    if (val == null || val === '' || val === '[]' || val === 'null') return;
    if (key.startsWith('_') || key === 'source_row' || key === 'source_file' || key === 'source_sheet') {
      metaFields.push([key, val]);
    } else if (key.includes('date') || key.includes('period') || isIsoDate(val)) {
      dateFields.push([key, val]);
    } else if (key.includes('location') || key.includes('coordinate') || key.includes('geo') || key.includes('admin')) {
      locationFields.push([key, val]);
    } else if (isUuid(val)) {
      referenceFields.push([key, val]);
    } else if (key.includes('num_') || key.includes('count') || key.includes('total') || (typeof val === 'number')) {
      countFields.push([key, val]);
    } else {
      otherFields.push([key, val]);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-gray-700">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{campaignName !== '--' ? campaignName : t('submissionDetails')}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {domain && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', DOMAIN_COLORS[domain] ?? 'bg-gray-100 text-gray-700')}>
                    {DOMAIN_LABELS[domain] ?? domain}
                  </span>
                )}
                <StatusBadge status={item.status} />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">

          {/* ── Overview cards ── */}
          <div className="grid grid-cols-3 gap-3 px-6 py-4">
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Submitted</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(item.submittedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <Shield className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Classification</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.dataClassification}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <Tag className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Version</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">v{item.version}</p>
              </div>
            </div>
          </div>

          {/* ── Data sections ── */}
          <div className="space-y-1 px-6 pb-6">

            {/* Core data fields */}
            {otherFields.length > 0 && (
              <DataSection title="Core Information" icon={<FileText className="h-4 w-4" />} fields={otherFields} defaultOpen />
            )}

            {/* Dates */}
            {dateFields.length > 0 && (
              <DataSection title="Dates & Periods" icon={<Calendar className="h-4 w-4" />} fields={dateFields} defaultOpen />
            )}

            {/* Location */}
            {locationFields.length > 0 && (
              <DataSection title="Location" icon={<MapPin className="h-4 w-4" />} fields={locationFields} defaultOpen />
            )}

            {/* Numbers */}
            {countFields.length > 0 && (
              <DataSection title="Counts & Numbers" icon={<Tag className="h-4 w-4" />} fields={countFields} defaultOpen />
            )}

            {/* Reference IDs */}
            {referenceFields.length > 0 && (
              <DataSection title="Reference Data" icon={<Globe className="h-4 w-4" />} fields={referenceFields} />
            )}

            {/* Source/Meta */}
            {metaFields.length > 0 && (
              <DataSection title="Import Metadata" icon={<FileText className="h-4 w-4" />} fields={metaFields} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Collapsible data section ─────────────────────────────────────────────── */

function DataSection({ title, icon, fields, defaultOpen = false }: {
  title: string;
  icon: React.ReactNode;
  fields: [string, unknown][];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="text-gray-400">{icon}</span>
          {title}
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {fields.length}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {fields.map(([key, val]) => (
            <div key={key} className="flex items-start gap-3 px-4 py-2 even:bg-gray-50/50 dark:even:bg-gray-800/20">
              <span className="min-w-[140px] shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 pt-0.5">
                {fieldLabel(key)}
              </span>
              <span className="text-sm text-gray-900 dark:text-white break-all">
                <FieldValue value={val} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Smart field value renderer ───────────────────────────────────────────── */

function FieldValue({ value }: { value: unknown }) {
  if (value == null || value === '') return <span className="text-gray-300">--</span>;

  // UUID → short tag
  if (isUuid(value)) {
    return (
      <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-mono text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
        {(value as string).slice(0, 8)}...
      </span>
    );
  }

  // ISO Date → formatted
  if (isIsoDate(value)) {
    return <span>{formatDate(value as string)}</span>;
  }

  // JSON object (location, etc)
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    // Geo coordinates
    if ('lat' in obj && 'lng' in obj) {
      return (
        <span className="inline-flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3 text-blue-500" />
          <span className="font-mono">{Number(obj.lat).toFixed(4)}, {Number(obj.lng).toFixed(4)}</span>
          {obj.accuracy && <span className="text-gray-400">(+/-{Number(obj.accuracy).toFixed(0)}m)</span>}
        </span>
      );
    }

    // Admin location
    if ('level_0' in obj) {
      const parts = Object.entries(obj)
        .filter(([, v]) => v != null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b));
      return (
        <div className="flex flex-wrap gap-1">
          {parts.map(([k, v]) => (
            <span key={k} className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-xs dark:bg-blue-900/20">
              <span className="text-blue-400 mr-1">{k.replace('level_', 'L')}:</span>
              <span className="text-blue-700 dark:text-blue-300 font-mono">{isUuid(v) ? (v as string).slice(0, 6) : String(v)}</span>
            </span>
          ))}
        </div>
      );
    }

    // Multilingual JSON name
    if ('en' in obj || 'fr' in obj) {
      return <span>{localizeName(obj)}</span>;
    }

    // Generic object
    return (
      <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
        {JSON.stringify(obj).slice(0, 120)}
      </span>
    );
  }

  // Array
  if (Array.isArray(value)) {
    if (value.length === 0 || (value.length === 1 && value[0] === '')) return <span className="text-gray-300">--</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">{String(v)}</span>
        ))}
      </div>
    );
  }

  // Boolean
  if (typeof value === 'boolean') {
    return value
      ? <span className="text-green-600 font-medium text-xs">Yes</span>
      : <span className="text-gray-400 text-xs">No</span>;
  }

  // String that is "[]" or empty JSON
  if (typeof value === 'string' && (value === '[]' || value === '{}')) {
    return <span className="text-gray-300">--</span>;
  }

  // Default string/number
  return <span>{String(value)}</span>;
}

/* ── Workflow Detail Modal ────────────────────────────────────────────────── */

function WorkflowDetailModal({ item, onClose, t }: {
  item: WorkflowItem; onClose: () => void; t: (key: string) => string;
}) {
  const { data: detail } = useWorkflowDetail(item.id);
  const instance = detail?.data ?? item;
  const transitions = instance.transitions ?? [];
  const level = LEVEL_CONFIG[instance.currentLevel] ?? LEVEL_CONFIG.NATIONAL_TECHNICAL;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('workflowInstance')}</h2>
            <p className="mt-0.5 text-xs text-gray-500 font-mono">{instance.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-4">
          <InfoCell label={t('currentStep')}><div className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', level.dot)} /><span className={cn('text-sm font-medium', level.color)}>{level.shortLabel} - {t(level.label)}</span></div></InfoCell>
          <InfoCell label={t('status')}><StatusBadge status={instance.status} /></InfoCell>
          <InfoCell label="Domain"><span>{instance.domain}</span></InfoCell>
          <InfoCell label="Entity Type"><span>{instance.entityType}</span></InfoCell>
          <InfoCell label={t('date')}><span>{formatDateTime(instance.createdAt)}</span></InfoCell>
          <InfoCell label="SLA Deadline"><span>{instance.slaDeadline ? formatDateTime(instance.slaDeadline) : '--'}</span></InfoCell>
        </div>
        {transitions.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('validationTimeline')}</h3>
            <div className="space-y-3">
              {transitions.map((tr, idx) => (
                <div key={tr.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-white text-xs', tr.action === 'APPROVE' ? 'bg-green-500' : tr.action === 'REJECT' ? 'bg-red-500' : tr.action === 'RETURN' ? 'bg-orange-500' : 'bg-blue-500')}>
                      {tr.action === 'APPROVE' ? <CheckCircle className="h-3.5 w-3.5" /> : tr.action === 'REJECT' ? <XCircle className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    </div>
                    {idx < transitions.length - 1 && <div className="mt-1 h-full w-0.5 bg-gray-200 dark:bg-gray-700" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{statusLabel(tr.action)}</p>
                    <p className="text-xs text-gray-500">{tr.actorRole} - {formatDateTime(tr.createdAt)}</p>
                    {tr.comment && <p className="mt-1 text-xs italic text-gray-600 dark:text-gray-300">&ldquo;{tr.comment}&rdquo;</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* ── Action Dialog ────────────────────────────────────────────────────────── */

function ActionDialog({ itemId, action, onClose, onConfirm, isPending, t }: {
  itemId: string; action: 'approve' | 'reject' | 'return'; onClose: () => void;
  onConfirm: (text: string) => void; isPending: boolean; t: (key: string) => string;
}) {
  const [text, setText] = useState('');
  const needsReason = action === 'reject' || action === 'return';
  const canSubmit = !needsReason || text.trim().length > 0;
  const titles = { approve: t('validateSubmission'), reject: t('rejectSubmission'), return: t('returnForCorrection') };
  const btnColors = { approve: 'bg-green-600 hover:bg-green-700', reject: 'bg-red-600 hover:bg-red-700', return: 'bg-orange-600 hover:bg-orange-700' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{titles[action]}</h3>
        <p className="mt-1 text-sm text-gray-500">ID: <span className="font-mono">{itemId.slice(0, 8)}</span></p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {needsReason ? t('reason') : t('commentLabel')}
            {needsReason && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={action === 'reject' ? t('reasonForRejection') : action === 'return' ? t('whatNeedsCorrecting') : t('addCommentPlaceholder')}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">{t('cancel')}</button>
          <button onClick={() => onConfirm(text)} disabled={isPending || !canSubmit}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50', btnColors[action])}>
            {isPending ? t('processing') : titles[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Main Page                                                           ── */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function WorkflowPage() {
  const t = useTranslations('workflow');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [levelFilter, setLevelFilter] = useState<string | undefined>(undefined);
  const [viewingSub, setViewingSub] = useState<SubmissionRecord | null>(null);
  const [viewingWf, setViewingWf] = useState<WorkflowItem | null>(null);
  const [actionDialog, setActionDialog] = useState<{ id: string; action: 'approve' | 'reject' | 'return' } | null>(null);

  const { submissionData, workflowData, hasWorkflowData, isLoading, isError, refetch } =
    useWorkflowItems({ page, limit: PAGE_SIZE, status: statusFilter, level: levelFilter });
  const { data: dashboardRes } = useWorkflowDashboard();
  const dashboard = dashboardRes?.data;
  const workflowAction = useWorkflowAction();

  const submissions = submissionData?.data ?? [];
  const subTotal = submissionData?.meta?.total ?? 0;
  const wfItems = workflowData?.data ?? [];
  const wfTotal = workflowData?.meta?.total ?? 0;
  const displayTotal = hasWorkflowData ? wfTotal : subTotal;
  const totalPages = Math.ceil(displayTotal / PAGE_SIZE);

  function handleAction(id: string, action: 'approve' | 'reject' | 'return', text: string) {
    workflowAction.mutate(
      { id, action, ...(action === 'approve' ? { comment: text } : { reason: text }) },
      { onSuccess: () => setActionDialog(null) },
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('pageSubtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hasWorkflowData ? (
          <>
            <KpiCard icon={<Clock className="h-5 w-5 text-amber-600" />} bg="bg-amber-50 dark:bg-amber-900/20" label={t('pendingValidation')} value={dashboard?.totalPending ?? 0} />
            <KpiCard icon={<CheckCircle className="h-5 w-5 text-green-600" />} bg="bg-green-50 dark:bg-green-900/20" label="Approved" value={dashboard?.totalApproved ?? 0} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-600" />} bg="bg-red-50 dark:bg-red-900/20" label={'SLA ' + t('overdue')} value={dashboard?.slaBreaches ?? 0} />
            <KpiCard icon={<Shield className="h-5 w-5 text-blue-600" />} bg="bg-blue-50 dark:bg-blue-900/20" label="WAHIS Ready" value={dashboard?.wahisReadyCount ?? 0} />
          </>
        ) : (
          <>
            <KpiCard icon={<FileText className="h-5 w-5 text-blue-600" />} bg="bg-blue-50 dark:bg-blue-900/20" label="Total Submissions" value={subTotal.toLocaleString()} />
            <KpiCard icon={<Clock className="h-5 w-5 text-amber-600" />} bg="bg-amber-50 dark:bg-amber-900/20" label="Awaiting Review" value={submissions.filter((s) => s.status === 'SUBMITTED').length} />
            <KpiCard icon={<CheckCircle className="h-5 w-5 text-green-600" />} bg="bg-green-50 dark:bg-green-900/20" label="Validated" value={submissions.filter((s) => s.status === 'VALIDATED').length} />
            <KpiCard icon={<Shield className="h-5 w-5 text-purple-600" />} bg="bg-purple-50 dark:bg-purple-900/20" label="Pipeline Ready" value={dashboard?.totalPending ?? 0} />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {hasWorkflowData && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={levelFilter ?? ''} onChange={(e) => { setLevelFilter(e.target.value || undefined); setPage(1); }}
              className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">{t('allLevels')}</option>
              {ALL_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(LEVEL_CONFIG[lvl].label)}</option>)}
            </select>
          </div>
        )}
        <select value={statusFilter ?? ''} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <option value="">{t('allStatuses')}</option>
          {(hasWorkflowData ? ALL_WF_STATUSES : ALL_SUB_STATUSES).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : isError ? (
        <QueryError message="Failed to load data" onRetry={() => refetch()} />
      ) : (hasWorkflowData ? wfItems : submissions).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
          <Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{t('noItems')}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statusFilter || levelFilter ? t('adjustFilters') : t('noItemsHint')}</p>
        </div>
      ) : hasWorkflowData ? (
        <WorkflowTable items={wfItems} total={displayTotal} page={page} totalPages={totalPages} setPage={setPage}
          onView={setViewingWf} onAction={(id, action) => setActionDialog({ id, action })} t={t} />
      ) : (
        <SubmissionsTable items={submissions} total={displayTotal} page={page} totalPages={totalPages} setPage={setPage}
          onView={setViewingSub} t={t} />
      )}

      {/* Modals */}
      {viewingSub && <SubmissionDetailModal item={viewingSub} onClose={() => setViewingSub(null)} t={t} />}
      {viewingWf && <WorkflowDetailModal item={viewingWf} onClose={() => setViewingWf(null)} t={t} />}
      {actionDialog && <ActionDialog itemId={actionDialog.id} action={actionDialog.action} onClose={() => setActionDialog(null)}
        onConfirm={(text) => handleAction(actionDialog.id, actionDialog.action, text)} isPending={workflowAction.isPending} t={t} />}
    </div>
  );
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */

function KpiCard({ icon, bg, label, value, children }: {
  icon: React.ReactNode; bg: string; label: string; value: number | string; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bg)}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Submissions Table ────────────────────────────────────────────────────── */

function SubmissionsTable({ items, total, page, totalPages, setPage, onView, t }: {
  items: SubmissionRecord[];
  total: number; page: number; totalPages: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  onView: (item: SubmissionRecord) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('date')}</th>
              <th className="px-4 py-3">Classification</th>
              <th className="px-4 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const campaignName = localizeName((item as any).campaignName);
              const domain = (item as any).domain as string | undefined;
              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-[280px]">
                        {campaignName !== '--' ? campaignName : <span className="font-mono text-xs text-gray-400">{item.campaignId.slice(0, 8)}</span>}
                      </p>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">{item.id.slice(0, 12)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {domain ? (
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', DOMAIN_COLORS[domain] ?? 'bg-gray-100 text-gray-600')}>
                        {DOMAIN_LABELS[domain] ?? domain}
                      </span>
                    ) : <span className="text-gray-400 text-xs">--</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(item.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {item.dataClassification}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onView(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                        {t('details')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} totalPages={totalPages} setPage={setPage} t={t} />
    </div>
  );
}

/* ── Workflow Instances Table ──────────────────────────────────────────────── */

function WorkflowTable({ items, total, page, totalPages, setPage, onView, onAction, t }: {
  items: WorkflowItem[]; total: number; page: number; totalPages: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  onView: (item: WorkflowItem) => void;
  onAction: (id: string, action: 'approve' | 'reject' | 'return') => void;
  t: (key: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">{t('colLevel')}</th>
              <th className="px-4 py-3">{t('colStatus')}</th>
              <th className="px-4 py-3">{t('colDate')}</th>
              <th className="px-4 py-3">{t('deadline')}</th>
              <th className="px-4 py-3 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const level = LEVEL_CONFIG[item.currentLevel] ?? LEVEL_CONFIG.NATIONAL_TECHNICAL;
              const isActionable = ['PENDING', 'IN_REVIEW', 'RETURNED'].includes(item.status);
              const isOverdue = item.slaDeadline && new Date(item.slaDeadline) < new Date() && isActionable;
              return (
                <tr key={item.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', isOverdue && 'bg-red-50/30 dark:bg-red-900/5')}>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{DOMAIN_LABELS[item.domain] ?? item.domain}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', level.dot)} />
                      <span className={cn('text-xs font-medium', level.color)}>{level.shortLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    {item.slaDeadline ? (
                      <span className={cn('text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-gray-500')}>
                        {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}{formatDate(item.slaDeadline)}
                      </span>
                    ) : <span className="text-xs text-gray-400">--</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onView(item)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 transition-colors">
                        <Eye className="h-3.5 w-3.5" /> {t('details')}
                      </button>
                      {isActionable && (
                        <>
                          <button onClick={() => onAction(item.id, 'approve')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 transition-colors">
                            <CheckCircle className="h-3.5 w-3.5" /> {t('approve')}
                          </button>
                          <button onClick={() => onAction(item.id, 'reject')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 transition-colors">
                            <XCircle className="h-3.5 w-3.5" /> {t('reject')}
                          </button>
                          <button onClick={() => onAction(item.id, 'return')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" /> {t('returnAction')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} totalPages={totalPages} setPage={setPage} t={t} />
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────────────────────────── */

function Pagination({ total, page, totalPages, setPage, t }: {
  total: number; page: number; totalPages: number;
  setPage: (p: number | ((prev: number) => number)) => void; t: (key: string) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('showing')} <span className="font-medium text-gray-700 dark:text-gray-300">{(page - 1) * PAGE_SIZE + 1}</span>
        {' - '}<span className="font-medium text-gray-700 dark:text-gray-300">{Math.min(page * PAGE_SIZE, total)}</span>
        {' '}{t('of')} <span className="font-medium text-gray-700 dark:text-gray-300">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <ChevronLeft className="h-4 w-4" /> {t('previous')}
        </button>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {t('next')} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
