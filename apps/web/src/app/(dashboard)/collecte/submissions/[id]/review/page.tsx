'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  FileText,
  MapPin,
  Calendar,
  Tag,
  Globe,
  ChevronDown,
  ChevronUp,
  Play,
  Shield,
  BarChart3,
  Users,
  Loader2,
  Info,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSubmission,
  useWorkflowAction,
  useStartValidation,
  useUpdateSubmissionStatus,
  type WorkflowLevel,
  type WorkflowTransition,
  type QualityGateStatus,
} from '@/lib/api/hooks';
import { useFormBuilderTemplate } from '@/lib/api/form-builder-hooks';
import { useWorkflowInstances } from '@/lib/api/workflow-hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSubmissionRealtime } from '@/lib/realtime/use-workflow-realtime';
import { useTranslations } from '@/lib/i18n/translations';
import type { FormSchema } from '@/components/form-builder/utils/form-schema';

/* ── Constants ──────────────────────────────────────────────────────────── */

const LEVEL_CONFIG: Record<WorkflowLevel, { label: string; shortLabel: string; dot: string; bg: string }> = {
  NATIONAL_TECHNICAL:      { label: 'level1', shortLabel: 'L1', dot: 'bg-blue-500',   bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  NATIONAL_OFFICIAL:       { label: 'level2', shortLabel: 'L2', dot: 'bg-green-500',  bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  REC_HARMONIZATION:       { label: 'level3', shortLabel: 'L3', dot: 'bg-orange-500', bg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  CONTINENTAL_PUBLICATION: { label: 'level4', shortLabel: 'L4', dot: 'bg-purple-500', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
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
  DRAFT:      { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
};

const GATE_LABELS: Record<string, string> = {
  completeness: 'Completeness',
  temporal_consistency: 'Temporal Consistency',
  geographic_consistency: 'Geographic Consistency',
  codes_vocabularies: 'Codes & Vocabularies',
  units: 'Units',
  deduplication: 'Deduplication',
  auditability: 'Auditability',
  confidence_score: 'Confidence Score',
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso?.slice(0, 10) ?? '--'; }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso?.slice(0, 16) ?? '--'; }
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

function isUuid(v: unknown): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isIsoDate(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s)/.test(v);
}

function fieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status.toUpperCase()] ?? { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', s.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {statusLabel(status)}
    </span>
  );
}

/* ── Smart Field Renderer ────────────────────────────────────────────────── */

function FieldValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null || value === '' || value === '[]' || value === '{}' || value === 'null') {
    return <span className="text-gray-300 italic text-xs dark:text-gray-600">N/A</span>;
  }

  if (isUuid(value)) {
    return (
      <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-mono text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
        {(value as string).slice(0, 8)}
      </span>
    );
  }

  if (isIsoDate(value)) return <span className="text-sm text-gray-900 dark:text-white">{formatDate(value as string)}</span>;

  if (typeof value === 'boolean') {
    return value
      ? <span className="text-green-600 font-medium text-xs">Yes</span>
      : <span className="text-gray-400 text-xs">No</span>;
  }

  if (typeof value === 'number') {
    return <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</span>;
  }

  if (typeof value === 'string') return <span className="text-sm text-gray-900 dark:text-white">{value}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-300 italic text-xs dark:text-gray-600">Empty</span>;
    if (value.every((v) => typeof v !== 'object' || v === null)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span key={i} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
              <FieldValue value={v} depth={depth + 1} />
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2 w-full">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(item as Record<string, unknown>).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k} className="flex items-start gap-2">
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap min-w-[70px]">{fieldLabel(k)}</span>
                  <span className="text-xs"><FieldValue value={v} depth={depth + 1} /></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('lat' in obj && 'lng' in obj) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-mono text-blue-700 dark:text-blue-300">{Number(obj.lat).toFixed(4)}, {Number(obj.lng).toFixed(4)}</span>
          {obj.accuracy != null && <span className="text-gray-400 text-xs">(+/-{Number(obj.accuracy).toFixed(0)}m)</span>}
        </span>
      );
    }
    if ('level_0' in obj) {
      return (
        <div className="flex flex-wrap gap-1">
          {Object.entries(obj).filter(([, v]) => v != null && v !== '').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
            <span key={k} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs dark:bg-blue-900/20">
              <span className="text-blue-400 mr-1 font-medium">{k.replace('level_', 'L')}</span>
              <span className="text-blue-700 dark:text-blue-300">{isUuid(v) ? (v as string).slice(0, 6) + '..' : String(v)}</span>
            </span>
          ))}
        </div>
      );
    }
    if ('en' in obj || 'fr' in obj) return <span className="text-sm text-gray-900 dark:text-white">{localizeName(obj)}</span>;
    const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return <span className="text-gray-300 italic text-xs dark:text-gray-600">Empty</span>;
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-0.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase min-w-[60px]">{fieldLabel(k)}</span>
            <span className="text-xs"><FieldValue value={v} depth={depth + 1} /></span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-sm">{String(value)}</span>;
}

/* ── Collapsible Section ─────────────────────────────────────────────────── */

function CollapsibleSection({ title, icon, defaultOpen = true, count, children }: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="text-gray-400">{icon}</span>{title}
          {count != null && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Schema-Aware Form Data View ─────────────────────────────────────────── */

function SchemaFormDataView({ schema, data }: { schema: FormSchema; data: Record<string, unknown> }) {
  const sections = schema?.sections ?? [];
  // Build a set of known field codes
  const knownCodes = new Set<string>();
  sections.forEach((sec) => sec.fields.forEach((f) => knownCodes.add(f.code)));

  // Fields not matched to any section
  const unmatchedEntries = Object.entries(data).filter(([key]) => !knownCodes.has(key) && data[key] != null && data[key] !== '');

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const sectionFields = section.fields
          .filter((f) => !f.hidden)
          .sort((a, b) => a.order - b.order)
          .filter((f) => data[f.code] != null && data[f.code] !== '');

        if (sectionFields.length === 0) return null;

        return (
          <CollapsibleSection
            key={section.id}
            title={localizeName(section.name)}
            icon={<FileText className="h-4 w-4" />}
            defaultOpen={true}
            count={sectionFields.length}
          >
            {sectionFields.map((field) => (
              <div key={field.id} className="flex items-start gap-3 px-4 py-2.5 even:bg-gray-50/50 dark:even:bg-gray-800/20">
                <span className="min-w-[160px] shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 pt-0.5">
                  {localizeName(field.label) || fieldLabel(field.code)}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <FieldValue value={data[field.code]} />
                </div>
              </div>
            ))}
          </CollapsibleSection>
        );
      })}

      {unmatchedEntries.length > 0 && (
        <CollapsibleSection
          title="Other Fields"
          icon={<Tag className="h-4 w-4" />}
          defaultOpen={false}
          count={unmatchedEntries.length}
        >
          {unmatchedEntries.map(([key, val]) => (
            <div key={key} className="flex items-start gap-3 px-4 py-2.5 even:bg-gray-50/50 dark:even:bg-gray-800/20">
              <span className="min-w-[160px] shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 pt-0.5">{fieldLabel(key)}</span>
              <div className="flex-1 min-w-0"><FieldValue value={val} /></div>
            </div>
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}

/** Fallback view when schema is not available — groups fields heuristically */
function RawFormDataView({ data }: { data: Record<string, unknown> }) {
  const dateF: [string, unknown][] = [];
  const locF: [string, unknown][] = [];
  const refF: [string, unknown][] = [];
  const numF: [string, unknown][] = [];
  const arrF: [string, unknown][] = [];
  const metaF: [string, unknown][] = [];
  const coreF: [string, unknown][] = [];

  Object.entries(data).forEach(([key, val]) => {
    if (val == null || val === '' || val === 'null') return;
    if (key.startsWith('_') || key === 'source_row' || key === 'source_file' || key === 'source_sheet') metaF.push([key, val]);
    else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') arrF.push([key, val]);
    else if (key.includes('date') || key.includes('period') || isIsoDate(val)) dateF.push([key, val]);
    else if (key.includes('location') || key.includes('coordinate') || key.includes('geo') || key.includes('admin')) locF.push([key, val]);
    else if (isUuid(val)) refF.push([key, val]);
    else if (key.includes('num_') || typeof val === 'number') numF.push([key, val]);
    else coreF.push([key, val]);
  });

  const sections = [
    { title: 'Core Information', icon: <FileText className="h-4 w-4" />, fields: coreF, open: true },
    { title: 'Detailed Records', icon: <Users className="h-4 w-4" />, fields: arrF, open: true },
    { title: 'Dates & Periods', icon: <Calendar className="h-4 w-4" />, fields: dateF, open: true },
    { title: 'Location', icon: <MapPin className="h-4 w-4" />, fields: locF, open: true },
    { title: 'Counts & Statistics', icon: <BarChart3 className="h-4 w-4" />, fields: numF, open: true },
    { title: 'Reference Data', icon: <Globe className="h-4 w-4" />, fields: refF, open: false },
    { title: 'Import Metadata', icon: <Tag className="h-4 w-4" />, fields: metaF, open: false },
  ].filter((s) => s.fields.length > 0);

  return (
    <div className="space-y-3">
      {sections.map((sec) => (
        <CollapsibleSection key={sec.title} title={sec.title} icon={sec.icon} defaultOpen={sec.open} count={sec.fields.length}>
          {sec.fields.map(([key, val]) => (
            <div key={key} className="flex items-start gap-3 px-4 py-2.5 even:bg-gray-50/50 dark:even:bg-gray-800/20">
              <span className="min-w-[140px] shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 pt-0.5">{fieldLabel(key)}</span>
              <div className="flex-1 min-w-0"><FieldValue value={val} /></div>
            </div>
          ))}
        </CollapsibleSection>
      ))}
    </div>
  );
}

/* ── Quality Gate Icon ───────────────────────────────────────────────────── */

function GateIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

/* ── Workflow Timeline Entry Icon ────────────────────────────────────────── */

function TransitionIcon({ action }: { action: string }) {
  switch (action) {
    case 'APPROVE': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'REJECT': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'RETURN': return <RotateCcw className="h-4 w-4 text-orange-500" />;
    case 'ESCALATE': return <AlertTriangle className="h-4 w-4 text-purple-500" />;
    case 'SUBMIT': return <Play className="h-4 w-4 text-blue-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Main Review Page                                                    ── */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function SubmissionReviewPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('collecte');

  // Real-time updates for this submission
  useSubmissionRealtime(id);

  // Fetch submission
  const { data: subRes, isLoading: subLoading } = useSubmission(id);
  const submission = subRes?.data;

  // Fetch template schema
  const templateId = submission?.templateId;
  const { data: templateRes } = useFormBuilderTemplate(templateId);
  const template = templateRes?.data;
  const schema = template?.schema as FormSchema | undefined;

  // Fetch workflow instance for this submission (filter by entityId)
  const { data: wfRes } = useWorkflowInstances({ page: 1, limit: 1, entityId: id });
  const wfInstances = wfRes?.data ?? [];
  const workflowInstance = wfInstances[0] ?? null;

  // Mutations
  const workflowAction = useWorkflowAction();
  const startValidation = useStartValidation();
  const updateStatus = useUpdateSubmissionStatus();
  const isActionPending = workflowAction.isPending || startValidation.isPending || updateStatus.isPending;

  // Action state
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [actionText, setActionText] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'reject' | 'return'; reason: string } | null>(null);

  if (subLoading) return <DetailSkeleton />;

  if (!submission) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCampaigns')}
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
          Submission not found
        </div>
      </div>
    );
  }

  const formData = submission.data ?? {};
  const isSubmitted = submission.status === 'submitted';
  const currentLevel = workflowInstance?.currentLevel as WorkflowLevel | undefined;
  const transitions = (workflowInstance?.transitions ?? []) as WorkflowTransition[];

  function handleApprove() {
    if (workflowInstance) {
      workflowAction.mutate({ id: workflowInstance.id, action: 'approve', comment: actionText || undefined });
    } else {
      updateStatus.mutate({ id, status: 'VALIDATED' });
    }
    setActionType(null);
    setActionText('');
  }

  function handleRejectConfirm() {
    if (!confirmDialog) return;
    if (workflowInstance) {
      workflowAction.mutate({ id: workflowInstance.id, action: 'reject', reason: confirmDialog.reason });
    } else {
      updateStatus.mutate({ id, status: 'REJECTED', reason: confirmDialog.reason });
    }
    setConfirmDialog(null);
    setActionType(null);
    setActionText('');
  }

  function handleReturnConfirm() {
    if (!confirmDialog) return;
    if (workflowInstance) {
      workflowAction.mutate({ id: workflowInstance.id, action: 'return', reason: confirmDialog.reason });
    } else {
      updateStatus.mutate({ id, status: 'REJECTED', reason: `[RETURN] ${confirmDialog.reason}` });
    }
    setConfirmDialog(null);
    setActionType(null);
    setActionText('');
  }

  function handleStartPipeline() {
    startValidation.mutate({ entityType: 'Submission', entityId: id, domain: 'collecte' });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <Link
          href={submission.campaignId ? `/collecte/campaigns/${submission.campaignId}` : '/collecte'}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {submission.campaignName ? `Back to ${submission.campaignName}` : t('backToCampaigns')}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('reviewSubmission')}
          </h1>
          <StatusBadge status={submission.status} />
          <span className="text-xs text-gray-500 font-mono dark:text-gray-400">{id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Main grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ═══ LEFT: Form Data (2 cols) ═══ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {t('formData')}
            </h2>

            {schema ? (
              <SchemaFormDataView schema={schema} data={formData} />
            ) : (
              <RawFormDataView data={formData} />
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Status + Actions + Timeline + Quality (1 col) ═══ */}
        <div className="space-y-4">

          {/* ── Status Card ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              {t('validationStatus')}
            </h3>
            {workflowInstance ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Current Level</span>
                  {currentLevel && (
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', LEVEL_CONFIG[currentLevel].bg)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', LEVEL_CONFIG[currentLevel].dot)} />
                      {LEVEL_CONFIG[currentLevel].shortLabel} - {t(LEVEL_CONFIG[currentLevel].label)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                  <StatusBadge status={workflowInstance.status} />
                </div>
                {workflowInstance.slaDeadline && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">SLA Deadline</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">{formatDate(workflowInstance.slaDeadline)}</span>
                  </div>
                )}
                {workflowInstance.wahisReady && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" /> WAHIS Ready
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <Info className="h-4 w-4 shrink-0" />
                {t('noWorkflowYet')}
              </div>
            )}
          </div>

          {/* ── Actions Card ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Actions
            </h3>

            {isSubmitted ? (
              <div className="space-y-2">
                {/* Approve */}
                <button
                  onClick={() => setActionType(actionType === 'approve' ? null : 'approve')}
                  disabled={isActionPending}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 p-3 transition-all text-left',
                    actionType === 'approve' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 hover:border-green-300 dark:border-gray-700',
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('approveAdvance')}</p>
                  </div>
                </button>

                {/* Return */}
                <button
                  onClick={() => setActionType(actionType === 'return' ? null : 'return')}
                  disabled={isActionPending}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 p-3 transition-all text-left',
                    actionType === 'return' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 hover:border-orange-300 dark:border-gray-700',
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <RotateCcw className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('returnCorrection')}</p>
                  </div>
                </button>

                {/* Reject */}
                <button
                  onClick={() => setActionType(actionType === 'reject' ? null : 'reject')}
                  disabled={isActionPending}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 p-3 transition-all text-left',
                    actionType === 'reject' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 hover:border-red-300 dark:border-gray-700',
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('rejectSubmission')}</p>
                  </div>
                </button>

                {/* Action form */}
                {actionType && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    {actionType !== 'approve' && (
                      <textarea
                        rows={3}
                        value={actionText}
                        onChange={(e) => setActionText(e.target.value)}
                        placeholder={t('reasonRequired')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-3"
                      />
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setActionType(null); setActionText(''); }}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={() => {
                          if (actionType === 'approve') {
                            handleApprove();
                          } else {
                            setConfirmDialog({ type: actionType, reason: actionText });
                          }
                        }}
                        disabled={isActionPending || (actionType !== 'approve' && !actionText.trim())}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50',
                          actionType === 'approve' ? 'bg-green-600 hover:bg-green-700'
                            : actionType === 'reject' ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-orange-600 hover:bg-orange-700',
                        )}
                      >
                        {isActionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {actionType === 'approve' ? t('approveAdvance') : actionType === 'reject' ? t('rejectSubmission') : t('returnCorrection')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Start pipeline */}
                {!workflowInstance && (
                  <button
                    onClick={handleStartPipeline}
                    disabled={isActionPending}
                    className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-blue-300 p-3 transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20 mt-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Play className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('startPipeline')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Submit to 4-level validation</p>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
                  <StatusBadge status={submission.status} />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This submission has already been processed.</p>
                </div>
                {(submission.status === 'corrected' || submission.status === 'rejected') && (
                  <Link
                    href={`/collecte/submissions/${id}/edit`}
                    className="flex w-full items-center gap-3 rounded-lg border-2 border-orange-300 bg-orange-50 p-3 transition-all hover:border-orange-500 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                      <Edit3 className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('editSubmission')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('editSubmissionDesc')}</p>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ── Workflow Timeline ── */}
          {transitions.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                {t('validationTimeline')}
              </h3>
              <div className="space-y-3">
                {transitions.map((tr, idx) => {
                  const fromLvl = LEVEL_CONFIG[tr.fromLevel];
                  const toLvl = LEVEL_CONFIG[tr.toLevel];
                  return (
                    <div key={tr.id} className="flex gap-3">
                      <div className="relative flex flex-col items-center">
                        <TransitionIcon action={tr.action} />
                        {idx < transitions.length - 1 && (
                          <div className="flex-1 w-px bg-gray-200 dark:bg-gray-700 mt-1" />
                        )}
                      </div>
                      <div className="pb-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{statusLabel(tr.action)}</span>
                          {fromLvl && toLvl && tr.fromLevel !== tr.toLevel && (
                            <span className="text-[10px] text-gray-400">{fromLvl.shortLabel} → {toLvl.shortLabel}</span>
                          )}
                        </div>
                        {tr.comment && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 italic">&ldquo;{tr.comment}&rdquo;</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {tr.actorRole} &mdash; {formatDateTime(tr.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Quality Report ── */}
          {(submission.qualityGates ?? []).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-500" />
                {t('qualityReport')}
              </h3>

              {/* Overall score */}
              <div className={cn(
                'mb-3 rounded-lg border p-3 flex items-center justify-between',
                submission.qualityResult === 'pass' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                  : submission.qualityResult === 'fail' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
              )}>
                <div className="flex items-center gap-2">
                  <GateIcon status={submission.qualityResult} />
                  <span className="text-sm font-semibold">
                    {statusLabel(submission.qualityResult)}
                  </span>
                </div>
                <span className="text-lg font-bold">{submission.qualityScore}%</span>
              </div>

              {/* Gate list */}
              <div className="space-y-1">
                {(submission.qualityGates as QualityGateStatus[]).map((gate) => (
                  <div key={gate.gate} className="flex items-center gap-2 py-1.5 px-2 rounded-md even:bg-gray-50/50 dark:even:bg-gray-800/20">
                    <GateIcon status={gate.status} />
                    <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                      {GATE_LABELS[gate.gate] ?? gate.gate}
                    </span>
                    <span className="text-[10px] text-gray-400">{gate.message ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Submission Meta ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-gray-500" />
              {t('submissionMeta')}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">ID</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{id.slice(0, 12)}...</span>
              </div>
              {submission.campaignName && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Campaign</span>
                  <span className="text-gray-700 dark:text-gray-300">{submission.campaignName}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Submitted</span>
                <span className="text-gray-700 dark:text-gray-300">{formatDateTime(submission.submittedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">By</span>
                <span className="text-gray-700 dark:text-gray-300">{submission.submittedByName ?? '--'}</span>
              </div>
              {submission.zone && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Zone</span>
                  <span className="text-gray-700 dark:text-gray-300">{submission.zone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Workflow Level</span>
                <span className="text-gray-700 dark:text-gray-300">L{submission.workflowLevel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm Dialogs ── */}
      <ConfirmDialog
        open={confirmDialog?.type === 'reject'}
        onConfirm={handleRejectConfirm}
        onCancel={() => setConfirmDialog(null)}
        title={t('rejectSubmission')}
        message={confirmDialog?.reason ?? ''}
        confirmLabel={t('rejectSubmission')}
        variant="danger"
        loading={isActionPending}
      />
      <ConfirmDialog
        open={confirmDialog?.type === 'return'}
        onConfirm={handleReturnConfirm}
        onCancel={() => setConfirmDialog(null)}
        title={t('returnCorrection')}
        message={confirmDialog?.reason ?? ''}
        confirmLabel={t('returnCorrection')}
        variant="primary"
        loading={isActionPending}
      />
    </div>
  );
}
