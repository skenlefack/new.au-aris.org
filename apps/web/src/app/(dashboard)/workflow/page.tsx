'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Tag,
  Globe,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Play,
  Send,
  Users,
  BarChart3,
  Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  useWorkflowItems,
  useWorkflowAction,
  useWorkflowDashboard,
  useWorkflowDetail,
  useStartValidation,
  useUpdateSubmissionStatus,
  type WorkflowItem,
  type WorkflowLevel,
  type SubmissionRecord,
} from '@/lib/api/hooks';
import { collecteClient } from '@/lib/api/client';
import {
  useBulkWorkflowAction,
  useValidationChainsByUser,
  usePotentialValidators,
  useCreateValidationChain,
  useWorkflowTimeline,
} from '@/lib/api/workflow-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
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
const PAGE_SIZES = [10, 20, 50, 100];

/** Tabs mapping: each tab has a set of statuses it displays */
type TabKey = 'toValidate' | 'rejected' | 'returned' | 'validated';

const TAB_STATUS_MAP: Record<TabKey, string[]> = {
  toValidate: ['SUBMITTED', 'PENDING', 'IN_REVIEW', 'ESCALATED'],
  rejected: ['REJECTED'],
  returned: ['RETURNED'],
  validated: ['VALIDATED', 'APPROVED'],
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

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
function statusLabel(s: string): string { return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function localizeName(name: unknown): string {
  if (!name) return '--';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') { const n = name as Record<string, string>; return n.en || n.fr || n.pt || n.ar || Object.values(n).find((v) => v) || '--'; }
  return String(name);
}
function isUuid(v: unknown): boolean { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
function isIsoDate(v: unknown): boolean { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s)/.test(v); }
function fieldLabel(key: string): string { return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', s.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {statusLabel(status)}
    </span>
  );
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  CONTINENTAL_ADMIN: 'Continental Admin',
  REC_ADMIN: 'REC Admin',
  NATIONAL_ADMIN: 'National Admin',
  DATA_STEWARD: 'Data Steward',
  WAHIS_FOCAL_POINT: 'WAHIS Focal Point',
  ANALYST: 'Analyst',
  FIELD_AGENT: 'Field Agent',
};

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Smart Field Renderer                                                ── */
/* ══════════════════════════════════════════════════════════════════════════ */

function FieldValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null || value === '' || value === '[]' || value === '{}' || value === 'null') {
    return <span className="text-gray-300 italic text-xs">N/A</span>;
  }
  if (isUuid(value)) {
    return (
      <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-mono text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
        {(value as string).slice(0, 8)}
      </span>
    );
  }
  if (isIsoDate(value)) return <span className="text-sm">{formatDate(value as string)}</span>;
  if (typeof value === 'boolean') {
    return value ? <span className="text-green-600 font-medium text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>;
  }
  if (typeof value === 'number') {
    return <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</span>;
  }
  if (typeof value === 'string') return <span className="text-sm text-gray-900 dark:text-white">{value}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-300 italic text-xs">Empty</span>;
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
    if ('en' in obj || 'fr' in obj) return <span className="text-sm">{localizeName(obj)}</span>;
    const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return <span className="text-gray-300 italic text-xs">Empty</span>;
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

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Choose Validator Dialog                                             ── */
/* ══════════════════════════════════════════════════════════════════════════ */

function ChooseValidatorDialog({ onClose, onSelect, t }: {
  onClose: () => void;
  onSelect: (validatorId: string) => void;
  t: (key: string) => string;
}) {
  const { data: validatorsRes, isLoading } = usePotentialValidators(true);
  const validators = validatorsRes?.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm) return validators;
    const q = searchTerm.toLowerCase();
    return validators.filter(v =>
      v.displayName.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      (ROLE_LABELS[v.role] ?? v.role).toLowerCase().includes(q)
    );
  }, [validators, searchTerm]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('chooseValidator')}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{t('chooseValidatorDesc')}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('selectValidator')}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div className="max-h-[340px] overflow-y-auto px-6 pb-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">{t('noValidatorsFound')}</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all',
                    selectedId === v.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {v.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{v.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{v.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {ROLE_LABELS[v.role] ?? v.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            {t('cancel')}
          </button>
          <button
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={!selectedId}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t('sendForValidation')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Submission Detail Modal                                             ── */
/* ══════════════════════════════════════════════════════════════════════════ */

function SubmissionDetailModal({ item, onClose, onValidate, onReject, onReturn, onStartWorkflow, isActionPending, isMine, t }: {
  item: SubmissionRecord & { campaignName?: unknown; domain?: string };
  onClose: () => void;
  onValidate: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onReturn: (id: string, reason: string) => void;
  onStartWorkflow: (id: string, domain: string) => void;
  isActionPending: boolean;
  isMine: boolean;
  t: (key: string) => string;
}) {
  const [activeTab, setActiveTab] = useState<'data' | 'actions' | 'timeline'>('data');
  const [actionType, setActionType] = useState<'validate' | 'reject' | 'return' | null>(null);
  const [actionText, setActionText] = useState('');
  const [shakeModal, setShakeModal] = useState(false);

  // Fetch validation timeline if submission has a workflow instance
  const instanceId = (item as any).collecteInstance?.id;
  const { data: timelineData } = useWorkflowTimeline(instanceId);
  const timeline: any[] = (() => {
    const raw = (timelineData as any)?.data ?? timelineData;
    return Array.isArray(raw) ? raw : [];
  })();

  const handleBackdropClick = () => {
    setShakeModal(true);
    setTimeout(() => setShakeModal(false), 300);
  };

  const data = item.data ?? {};
  const campaignName = localizeName((item as any).campaignName);
  const domain = (item as any).domain as string | undefined;
  const isSubmitted = item.status === 'SUBMITTED';
  // At first stage (user's own data), reject/return are disabled
  const canRejectReturn = !isMine;

  // Categorize fields
  const sections: { title: string; icon: React.ReactNode; fields: [string, unknown][]; open: boolean }[] = [];
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

  if (coreF.length) sections.push({ title: 'Core Information', icon: <FileText className="h-4 w-4" />, fields: coreF, open: true });
  if (arrF.length) sections.push({ title: 'Detailed Records', icon: <Users className="h-4 w-4" />, fields: arrF, open: true });
  if (dateF.length) sections.push({ title: 'Dates & Periods', icon: <Calendar className="h-4 w-4" />, fields: dateF, open: true });
  if (locF.length) sections.push({ title: 'Location', icon: <MapPin className="h-4 w-4" />, fields: locF, open: true });
  if (numF.length) sections.push({ title: 'Counts & Statistics', icon: <BarChart3 className="h-4 w-4" />, fields: numF, open: true });
  if (refF.length) sections.push({ title: 'Reference Data', icon: <Globe className="h-4 w-4" />, fields: refF, open: false });
  if (metaF.length) sections.push({ title: 'Import Metadata', icon: <Tag className="h-4 w-4" />, fields: metaF, open: false });

  function handleActionSubmit() {
    if (!actionType) return;
    if (actionType === 'validate') onValidate(item.id);
    else if (actionType === 'reject') onReject(item.id, actionText);
    else if (actionType === 'return') onReturn(item.id, actionText);
    setActionType(null);
    setActionText('');
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div
        className={cn(
          'relative max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900',
          shakeModal && 'animate-[shake_0.3s_ease-in-out]',
        )}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="relative border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-white/60 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors z-10">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-gray-700">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-10">{campaignName !== '--' ? campaignName : t('submissionDetails')}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {domain && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', DOMAIN_COLORS[domain] ?? 'bg-gray-100 text-gray-700')}>{DOMAIN_LABELS[domain] ?? domain}</span>}
                <StatusBadge status={item.status} />
                <span className="text-xs text-gray-500 font-mono">{item.id.slice(0, 8)}</span>
                {item.submittedBy && <span className="text-xs text-gray-400">Soumis par: <span className="font-medium text-gray-600 dark:text-gray-300">{(item as any).submittedByName || item.submittedBy.slice(0, 8)}</span></span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setActiveTab('data')}
            className={cn('flex-1 py-2.5 text-sm font-medium text-center transition-colors', activeTab === 'data' ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            <Eye className="inline h-4 w-4 mr-1.5" />Donnees
          </button>
          <button onClick={() => setActiveTab('actions')}
            className={cn('flex-1 py-2.5 text-sm font-medium text-center transition-colors', activeTab === 'actions' ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            <CheckCircle className="inline h-4 w-4 mr-1.5" />Actions
          </button>
          <button onClick={() => setActiveTab('timeline')}
            className={cn('flex-1 py-2.5 text-sm font-medium text-center transition-colors', activeTab === 'timeline' ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            <Clock className="inline h-4 w-4 mr-1.5" />Suivi validation
            {timeline.length > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{timeline.length}</span>}
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="max-h-[calc(95vh-180px)] overflow-y-auto">

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
          }
        `}</style>

          {activeTab === 'data' ? (
            <>
              {/* Overview cards */}
              <div className="grid grid-cols-3 gap-3 px-6 py-4">
                <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                  <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Submitted</p><p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(item.submittedAt)}</p></div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <Shield className="h-4 w-4 text-gray-400 shrink-0" />
                  <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Classification</p><p className="text-sm font-semibold text-gray-900 dark:text-white">{item.dataClassification}</p></div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <Tag className="h-4 w-4 text-gray-400 shrink-0" />
                  <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Version</p><p className="text-sm font-semibold text-gray-900 dark:text-white">v{item.version}</p></div>
                </div>
              </div>

              {/* Data sections */}
              <div className="space-y-1 px-6 pb-6">
                {sections.map((sec) => <DataSection key={sec.title} {...sec} defaultOpen={sec.open} />)}
              </div>
            </>
          ) : activeTab === 'actions' ? (
            /* ── Actions & Comments Tab ── */
            <div className="px-6 py-4 space-y-4">

              {/* Quick actions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
                <div className="grid grid-cols-2 gap-3">

                  {isSubmitted && (
                    <>
                      <button
                        onClick={() => setActionType('validate')}
                        disabled={isActionPending}
                        className={cn('flex items-center gap-3 rounded-xl border-2 p-4 transition-all', actionType === 'validate' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 hover:border-green-300 dark:border-gray-700')}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30"><CheckCircle className="h-5 w-5 text-green-600" /></div>
                        <div className="text-left"><p className="text-sm font-semibold text-gray-900 dark:text-white">{t('validate')}</p><p className="text-xs text-gray-500">Mark as validated</p></div>
                      </button>

                      <button
                        onClick={() => onStartWorkflow(item.id, domain ?? 'collecte')}
                        disabled={isActionPending}
                        className="flex items-center gap-3 rounded-xl border-2 border-gray-200 p-4 transition-all hover:border-blue-300 dark:border-gray-700"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"><Play className="h-5 w-5 text-blue-600" /></div>
                        <div className="text-left"><p className="text-sm font-semibold text-gray-900 dark:text-white">Start Pipeline</p><p className="text-xs text-gray-500">Submit to 4-level validation</p></div>
                      </button>

                      <button
                        onClick={() => setActionType('return')}
                        disabled={isActionPending || !canRejectReturn}
                        className={cn('flex items-center gap-3 rounded-xl border-2 p-4 transition-all',
                          !canRejectReturn ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700' :
                          actionType === 'return' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 hover:border-orange-300 dark:border-gray-700')}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30"><RotateCcw className="h-5 w-5 text-orange-600" /></div>
                        <div className="text-left"><p className="text-sm font-semibold text-gray-900 dark:text-white">{t('returnAction')}</p><p className="text-xs text-gray-500">{isMine ? t('disabledFirstStage') : 'Send back for correction'}</p></div>
                      </button>

                      <button
                        onClick={() => setActionType('reject')}
                        disabled={isActionPending || !canRejectReturn}
                        className={cn('flex items-center gap-3 rounded-xl border-2 p-4 transition-all',
                          !canRejectReturn ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700' :
                          actionType === 'reject' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 hover:border-red-300 dark:border-gray-700')}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30"><XCircle className="h-5 w-5 text-red-600" /></div>
                        <div className="text-left"><p className="text-sm font-semibold text-gray-900 dark:text-white">{t('reject')}</p><p className="text-xs text-gray-500">{isMine ? t('disabledFirstStage') : 'Reject this submission'}</p></div>
                      </button>
                    </>
                  )}

                  {!isSubmitted && (
                    <div className="col-span-2 rounded-xl bg-gray-50 p-4 text-center dark:bg-gray-800">
                      <StatusBadge status={item.status} />
                      <p className="mt-2 text-sm text-gray-500">This submission has already been processed.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action form */}
              {actionType && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    {actionType === 'validate' ? t('validateSubmission') : actionType === 'reject' ? t('rejectSubmission') : t('returnForCorrection')}
                  </h4>
                  <textarea
                    rows={3}
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    placeholder={actionType === 'reject' ? t('reasonForRejection') : actionType === 'return' ? t('whatNeedsCorrecting') : t('addCommentPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-3"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setActionType(null); setActionText(''); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleActionSubmit}
                      disabled={isActionPending || (['reject', 'return'].includes(actionType ?? '') && !actionText.trim())}
                      className={cn('rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50', actionType === 'validate' ? 'bg-green-600 hover:bg-green-700' : actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700')}
                    >
                      {isActionPending ? t('processing') : actionType === 'validate' ? t('validateAndAdvance') : actionType === 'reject' ? t('reject') : t('returnForCorrection')}
                    </button>
                  </div>
                </div>
              )}

              {/* Comment section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  <MessageSquare className="inline h-4 w-4 mr-1.5" />Comments
                </h3>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="p-4 text-center text-sm text-gray-400">
                    No comments yet. Use the action buttons above to validate or return with a comment.
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'timeline' ? (
            /* ── Suivi validation Tab ── */
            <div className="px-6 py-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                Suivi de validation
                {timeline.length > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">{timeline.length} actions</span>}
              </h3>

              {timeline.length > 0 ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                  <div className="space-y-0">
                    {timeline.map((entry: any, idx: number) => {
                      const action = entry.action || entry.status || 'unknown';
                      const actionConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
                        submitted: { icon: <Send className="h-3.5 w-3.5" />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Soumission' },
                        validated: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Validation' },
                        approved: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Approbation' },
                        rejected: { icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Rejet' },
                        returned: { icon: <RotateCcw className="h-3.5 w-3.5" />, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Retour pour correction' },
                        escalated: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Escalade' },
                        auto_transmitted: { icon: <ArrowRight className="h-3.5 w-3.5" />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Transmission auto' },
                        auto_validated: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Validation auto' },
                        reassigned: { icon: <Users className="h-3.5 w-3.5" />, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'Reassignation' },
                        commented: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Commentaire' },
                      };
                      const cfg = actionConfig[action.toLowerCase()] || { icon: <Clock className="h-3.5 w-3.5" />, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800', label: action };
                      const performer = entry.performedByName || entry.performed_by_name || (entry.performedBy || entry.performed_by || '').slice(0, 8);
                      const performedAt = entry.performedAt || entry.performed_at;
                      const comment = typeof entry.comment === 'object' ? (entry.comment?.fr || entry.comment?.en || '') : (entry.comment || '');
                      const reason = entry.reason || '';
                      const fromStep = entry.fromStep ?? entry.from_step;
                      const toStep = entry.toStep ?? entry.to_step;
                      const isAuto = entry.isAutomatic || entry.is_automatic;

                      return (
                        <div key={entry.id || idx} className="relative flex items-start gap-4 pb-4 pl-2">
                          {/* Timeline dot */}
                          <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full', cfg.bg, cfg.color)}>
                            {cfg.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-sm font-semibold', cfg.color)}>{cfg.label}</span>
                              {isAuto && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">Auto</span>}
                              {fromStep != null && toStep != null && fromStep !== toStep && (
                                <span className="text-[10px] text-gray-400">Etape {fromStep} → {toStep}</span>
                              )}
                            </div>

                            {/* Performer + date */}
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                              {performer && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{performer}</span>
                                </span>
                              )}
                              {performedAt && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(performedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {' '}
                                  {new Date(performedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>

                            {/* Comment / reason */}
                            {(comment || reason) && (
                              <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2">
                                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{comment || reason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-10 text-center">
                  <Clock className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {instanceId ? 'Aucune action enregistree pour le moment' : "Le pipeline de validation n'a pas encore ete demarre"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {instanceId ? 'Les validations, rejets et retours apparaitront ici' : "Utilisez le bouton Start Pipeline dans l'onglet Actions"}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Collapsible data section ─────────────────────────────────────────────── */

function DataSection({ title, icon, fields, defaultOpen = false }: {
  title: string; icon: React.ReactNode; fields: [string, unknown][]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="text-gray-400">{icon}</span>{title}
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">{fields.length}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {fields.map(([key, val]) => (
            <div key={key} className="flex items-start gap-3 px-4 py-2.5 even:bg-gray-50/50 dark:even:bg-gray-800/20">
              <span className="min-w-[140px] shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 pt-0.5">{fieldLabel(key)}</span>
              <div className="flex-1 min-w-0"><FieldValue value={val} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* ── Main Page                                                           ── */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function WorkflowPage() {
  const t = useTranslations('workflow');
  const user = useAuthStore((s) => s.user);

  // Active tab
  const [activeTab, setActiveTab] = useState<TabKey>('toValidate');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [levelFilter, setLevelFilter] = useState<string | undefined>(undefined);
  const [viewingSub, setViewingSub] = useState<SubmissionRecord | null>(null);
  const [viewingWf, setViewingWf] = useState<WorkflowItem | null>(null);
  const [actionDialog, setActionDialog] = useState<{ id: string; action: 'approve' | 'reject' | 'return' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkToast, setBulkToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showValidatorChooser, setShowValidatorChooser] = useState<{ submissionId: string; domain: string } | null>(null);

  // Compute status filter from active tab
  const tabStatuses = TAB_STATUS_MAP[activeTab];

  // Map tab to the primary status for server-side filtering
  // "toValidate" uses SUBMITTED for submissions (PENDING/IN_REVIEW/ESCALATED are workflow-level)
  const TAB_PRIMARY_STATUS: Record<TabKey, string> = {
    toValidate: 'SUBMITTED',
    rejected: 'REJECTED',
    returned: 'RETURNED',
    validated: 'VALIDATED',
  };
  const primaryStatus = TAB_PRIMARY_STATUS[activeTab];

  const { submissionData, workflowData, hasWorkflowData, isLoading, isError, refetch } =
    useWorkflowItems({ page, limit: pageSize, status: primaryStatus, level: levelFilter });
  const { data: dashboardRes } = useWorkflowDashboard();
  const dashboard = dashboardRes?.data;
  const workflowAction = useWorkflowAction();
  const startValidation = useStartValidation();
  const updateStatus = useUpdateSubmissionStatus();
  const bulkAction = useBulkWorkflowAction();
  const createChain = useCreateValidationChain();

  // Check if user has a validation chain configured
  const { data: chainsRes } = useValidationChainsByUser(user?.id);
  const hasValidationChain = (chainsRes?.data ?? []).length > 0;

  // Filter submissions/workflow items by tab statuses (client-side for multi-status tabs)
  const allSubmissions = submissionData?.data ?? [];
  const subTotal = submissionData?.meta?.total ?? 0;
  const wfItems = workflowData?.data ?? [];
  const wfTotal = workflowData?.meta?.total ?? 0;

  // Server already filters by status; for workflow instances also accept related statuses
  const filteredSubmissions = allSubmissions;
  const filteredWfItems = wfItems.length > 0
    ? wfItems.filter((w) => tabStatuses.includes(w.status))
    : wfItems;

  // Enrich submissions with "isMine" flag for "À valider" tab
  const enrichedSubmissions = useMemo(() => {
    if (!user) return filteredSubmissions;
    return filteredSubmissions.map((s) => ({
      ...s,
      _isMine: s.submittedBy === user.id,
    }));
  }, [filteredSubmissions, user]);

  const displayTotal = hasWorkflowData ? wfTotal : subTotal;
  const totalPages = Math.ceil(displayTotal / pageSize);

  const isActionPending = workflowAction.isPending || startValidation.isPending || updateStatus.isPending;

  // Tab counts from separate lightweight queries (limit=1, just need meta.total)
  type CountResponse = { data: unknown[]; meta: { total: number; page: number; limit: number } };
  const countFallback: CountResponse = { data: [], meta: { total: 0, page: 1, limit: 1 } };
  const countOpts = (status: string) => ({
    queryKey: ['workflow', 'count', status],
    queryFn: async () => {
      try {
        return await collecteClient.get<CountResponse>('/collecte/submissions', { status, limit: '1' });
      } catch { return countFallback; }
    },
    placeholderData: countFallback,
    staleTime: 60_000,
  });
  const { data: countSubmitted } = useQuery(countOpts('SUBMITTED'));
  const { data: countRejected } = useQuery(countOpts('REJECTED'));
  const { data: countReturned } = useQuery(countOpts('RETURNED'));
  const { data: countValidated } = useQuery(countOpts('VALIDATED'));

  const tabCounts: Record<TabKey, number> = {
    toValidate: countSubmitted?.meta?.total ?? 0,
    rejected: countRejected?.meta?.total ?? 0,
    returned: countReturned?.meta?.total ?? 0,
    validated: countValidated?.meta?.total ?? 0,
  };

  function handleValidate(id: string) {
    updateStatus.mutate({ id, status: 'VALIDATED' }, { onSuccess: () => setViewingSub(null) });
  }
  function handleReject(id: string, reason: string) {
    updateStatus.mutate({ id, status: 'REJECTED', reason }, { onSuccess: () => setViewingSub(null) });
  }
  function handleReturn(id: string, reason: string) {
    updateStatus.mutate({ id, status: 'RETURNED', reason }, { onSuccess: () => setViewingSub(null) });
  }
  function handleStartWorkflow(entityId: string, domain: string) {
    // If user has no validation chain, show validator chooser dialog
    if (!hasValidationChain) {
      setShowValidatorChooser({ submissionId: entityId, domain });
      return;
    }
    startValidation.mutate(
      { entityType: 'Submission', entityId, domain },
      { onSuccess: () => setViewingSub(null) },
    );
  }
  function handleSelectValidator(validatorId: string) {
    if (!showValidatorChooser || !user) return;
    // Create the validation chain on-the-fly, then start the workflow
    createChain.mutate(
      {
        userId: user.id,
        validatorId,
        levelType: 'national',
        priority: 1,
      },
      {
        onSuccess: () => {
          // Now start the workflow
          startValidation.mutate(
            { entityType: 'Submission', entityId: showValidatorChooser.submissionId, domain: showValidatorChooser.domain },
            { onSuccess: () => { setShowValidatorChooser(null); setViewingSub(null); } },
          );
        },
      },
    );
  }
  function handleWfAction(id: string, action: 'approve' | 'reject' | 'return', text: string) {
    workflowAction.mutate(
      { id, action, ...(action === 'approve' ? { comment: text } : { reason: text }) },
      { onSuccess: () => setActionDialog(null) },
    );
  }

  function handleBulk(action: 'APPROVE' | 'REJECT' | 'RETURN') {
    if (selectedIds.size === 0) return;
    bulkAction.mutate(
      { ids: Array.from(selectedIds), action },
      {
        onSuccess: (res: any) => {
          const succeeded = res?.data?.succeeded ?? selectedIds.size;
          const failed = res?.data?.failed ?? 0;
          if (failed > 0) {
            setBulkToast({ message: t('bulkPartial', { succeeded: String(succeeded), failed: String(failed) }), type: 'error' });
          } else {
            setBulkToast({ message: t('bulkSuccess', { count: String(succeeded) }), type: 'success' });
          }
          setSelectedIds(new Set());
          setTimeout(() => setBulkToast(null), 4000);
        },
        onError: () => {
          setBulkToast({ message: t('bulkFailed') ?? 'Bulk action failed', type: 'error' });
          setTimeout(() => setBulkToast(null), 4000);
        },
      },
    );
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    setPage(1);
    setSelectedIds(new Set());
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(1);
    setSelectedIds(new Set());
  }

  const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
    { key: 'toValidate', label: t('tabToValidate'), icon: <Clock className="h-4 w-4" />, color: 'text-amber-600', activeColor: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    { key: 'rejected', label: t('tabRejected'), icon: <XCircle className="h-4 w-4" />, color: 'text-red-600', activeColor: 'border-red-500 bg-red-50 dark:bg-red-900/20' },
    { key: 'returned', label: t('tabReturned'), icon: <RotateCcw className="h-4 w-4" />, color: 'text-orange-600', activeColor: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' },
    { key: 'validated', label: t('tabValidated'), icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600', activeColor: 'border-green-500 bg-green-50 dark:bg-green-900/20' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('pageSubtitle')}</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Clock className="h-5 w-5 text-amber-600" />} bg="bg-amber-50 dark:bg-amber-900/20" label={t('pendingValidation')} value={dashboard?.totalPending ?? 0} />
        <KpiCard icon={<CheckCircle className="h-5 w-5 text-green-600" />} bg="bg-green-50 dark:bg-green-900/20" label={t('approved')} value={dashboard?.totalApproved ?? 0} />
        <KpiCard icon={<XCircle className="h-5 w-5 text-red-600" />} bg="bg-red-50 dark:bg-red-900/20" label={t('rejected')} value={dashboard?.totalRejected ?? 0} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-purple-600" />} bg="bg-purple-50 dark:bg-purple-900/20" label={t('overdue') + ' SLA'} value={dashboard?.slaBreaches ?? 0} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={cn(
              'relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all',
              activeTab === tab.key
                ? `${tab.activeColor} border-current`
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300',
            )}
          >
            <span className={activeTab === tab.key ? tab.color : ''}>{tab.icon}</span>
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span className={cn(
                'ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                activeTab === tab.key
                  ? 'bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
              )}>
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      {hasWorkflowData && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={levelFilter ?? ''} onChange={(e) => { setLevelFilter(e.target.value || undefined); setPage(1); setSelectedIds(new Set()); }}
              className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <option value="">{t('allLevels')}</option>
              {ALL_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(LEVEL_CONFIG[lvl].label)}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {isLoading ? <TableSkeleton rows={5} cols={6} />
        : isError ? <QueryError message="Failed to load data" onRetry={() => refetch()} />
        : (hasWorkflowData ? filteredWfItems : enrichedSubmissions).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
            <Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{t('noItems')}</h3>
            <p className="mt-1 text-sm text-gray-500">{levelFilter ? t('adjustFilters') : t('noItemsHint')}</p>
          </div>
        ) : hasWorkflowData ? (
          <WorkflowTable items={filteredWfItems} total={displayTotal} page={page} totalPages={totalPages} pageSize={pageSize} setPage={setPage} onPageSizeChange={handlePageSizeChange}
            onView={setViewingWf} onAction={(id, action) => setActionDialog({ id, action })} t={t}
            selectedIds={selectedIds} setSelectedIds={setSelectedIds} activeTab={activeTab} />
        ) : (
          <SubmissionsTable items={enrichedSubmissions} total={displayTotal} page={page} totalPages={totalPages} pageSize={pageSize} setPage={setPage} onPageSizeChange={handlePageSizeChange}
            onView={setViewingSub} t={t}
            selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
        )}

      {/* Modals — rendered via portal to escape layout stacking context */}
      {viewingSub && createPortal(
        <SubmissionDetailModal item={viewingSub} onClose={() => setViewingSub(null)}
          onValidate={handleValidate} onReject={handleReject} onReturn={handleReturn} onStartWorkflow={handleStartWorkflow}
          isActionPending={isActionPending} isMine={(viewingSub as any)._isMine ?? (viewingSub.submittedBy === user?.id)} t={t} />,
        document.body,
      )}
      {viewingWf && createPortal(
        <WfDetailModal item={viewingWf} onClose={() => setViewingWf(null)} t={t} />,
        document.body,
      )}
      {actionDialog && createPortal(
        <ActionDialog itemId={actionDialog.id} action={actionDialog.action} onClose={() => setActionDialog(null)}
          onConfirm={(text) => handleWfAction(actionDialog.id, actionDialog.action, text)} isPending={workflowAction.isPending} t={t} />,
        document.body,
      )}
      {showValidatorChooser && createPortal(
        <ChooseValidatorDialog onClose={() => setShowValidatorChooser(null)} onSelect={handleSelectValidator} t={t} />,
        document.body,
      )}

      {/* Bulk action floating bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedIds.size} {t('selected') ?? 'selected'}
          </span>
          <button
            onClick={() => handleBulk('APPROVE')}
            disabled={bulkAction.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t('bulkApprove')}
          </button>
          <button
            onClick={() => handleBulk('RETURN')}
            disabled={bulkAction.isPending || activeTab === 'toValidate'}
            title={activeTab === 'toValidate' ? t('disabledFirstStage') : ''}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('bulkReturn')}
          </button>
          <button
            onClick={() => handleBulk('REJECT')}
            disabled={bulkAction.isPending || activeTab === 'toValidate'}
            title={activeTab === 'toValidate' ? t('disabledFirstStage') : ''}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            {t('bulkReject')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
          >
            {t('bulkCancel')}
          </button>
        </div>
      )}

      {/* Bulk toast notification */}
      {bulkToast && (
        <div className={cn(
          'fixed top-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
          bulkToast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
        )}>
          {bulkToast.message}
        </div>
      )}
    </div>
  );
}

/* ── Components ───────────────────────────────────────────────────────────── */

function KpiCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bg)}>{icon}</div>
        <div><p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p></div>
      </div>
    </div>
  );
}

function SubmissionsTable({ items, total, page, totalPages, pageSize, setPage, onPageSizeChange, onView, t, selectedIds, setSelectedIds }: {
  items: (SubmissionRecord & { _isMine?: boolean })[]; total: number; page: number; totalPages: number; pageSize: number;
  setPage: (p: number | ((prev: number) => number)) => void; onPageSizeChange: (size: number) => void;
  onView: (item: SubmissionRecord) => void; t: (key: string) => string;
  selectedIds: Set<string>; setSelectedIds: (ids: Set<string>) => void;
}) {
  const allOnPage = items.map((i) => i.id);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selectedIds.has(id));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      allOnPage.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      allOnPage.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
            <th className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>
            <th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">{t('status')}</th>
            <th className="px-4 py-3">{t('colSubmittedBy')}</th><th className="px-4 py-3">{t('date')}</th><th className="px-4 py-3 text-right">{t('actions')}</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const cn2 = localizeName((item as any).campaignName);
              const domain = (item as any).domain as string | undefined;
              const isMine = (item as any)._isMine;
              return (
                <tr key={item.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', selectedIds.has(item.id) && 'bg-blue-50/50 dark:bg-blue-900/10')}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
                  <td className="px-4 py-3"><div><p className="font-medium text-gray-900 dark:text-white truncate max-w-[280px]">{cn2 !== '--' ? cn2 : <span className="font-mono text-xs text-gray-400">{item.campaignId.slice(0, 8)}</span>}</p><p className="text-[11px] font-mono text-gray-400 mt-0.5">{item.id.slice(0, 12)}</p></div></td>
                  <td className="px-4 py-3">
                    {isMine ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <FileText className="h-3 w-3" />{t('myData')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Users className="h-3 w-3" />{t('toReview')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{domain ? <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', DOMAIN_COLORS[domain] ?? 'bg-gray-100 text-gray-600')}>{DOMAIN_LABELS[domain] ?? domain}</span> : <span className="text-gray-400 text-xs">--</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{(item as any).submittedByName || item.submittedBy?.slice(0, 8) || '--'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(item.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onView(item)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 transition-colors">
                      <Eye className="h-3.5 w-3.5" />{t('details')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} totalPages={totalPages} pageSize={pageSize} setPage={setPage} onPageSizeChange={onPageSizeChange} t={t} />
    </div>
  );
}

function WorkflowTable({ items, total, page, totalPages, pageSize, setPage, onPageSizeChange, onView, onAction, t, selectedIds, setSelectedIds, activeTab }: {
  items: WorkflowItem[]; total: number; page: number; totalPages: number; pageSize: number;
  setPage: (p: number | ((prev: number) => number)) => void; onPageSizeChange: (size: number) => void;
  onView: (item: WorkflowItem) => void;
  onAction: (id: string, action: 'approve' | 'reject' | 'return') => void; t: (key: string) => string;
  selectedIds: Set<string>; setSelectedIds: (ids: Set<string>) => void;
  activeTab: TabKey;
}) {
  const allOnPage = items.map((i) => i.id);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selectedIds.has(id));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      allOnPage.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      allOnPage.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const showActions = activeTab === 'toValidate';
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
            <th className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>
            <th className="px-4 py-3">Domain</th><th className="px-4 py-3">{t('colLevel')}</th><th className="px-4 py-3">{t('colStatus')}</th>
            <th className="px-4 py-3">{t('colDate')}</th><th className="px-4 py-3">{t('deadline')}</th><th className="px-4 py-3 text-right">{t('colActions')}</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const level = LEVEL_CONFIG[item.currentLevel] ?? LEVEL_CONFIG.NATIONAL_TECHNICAL;
              const isActionable = showActions && ['PENDING', 'IN_REVIEW', 'RETURNED'].includes(item.status);
              const isOverdue = item.slaDeadline && new Date(item.slaDeadline) < new Date() && isActionable;
              return (
                <tr key={item.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', isOverdue && 'bg-red-50/30 dark:bg-red-900/5', selectedIds.has(item.id) && 'bg-blue-50/50 dark:bg-blue-900/10')}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
                  <td className="px-4 py-3">{DOMAIN_LABELS[item.domain] ?? item.domain}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', level.dot)} /><span className={cn('text-xs font-medium', level.color)}>{level.shortLabel}</span></div></td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">{item.slaDeadline ? <span className={cn('text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-gray-500')}>{isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}{formatDate(item.slaDeadline)}</span> : <span className="text-xs text-gray-400">--</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onView(item)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 transition-colors"><Eye className="h-3.5 w-3.5" /> {t('details')}</button>
                      {isActionable && <>
                        <button onClick={() => onAction(item.id, 'approve')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 transition-colors"><CheckCircle className="h-3.5 w-3.5" /> {t('approve')}</button>
                        <button onClick={() => onAction(item.id, 'reject')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 transition-colors"><XCircle className="h-3.5 w-3.5" /> {t('reject')}</button>
                        <button onClick={() => onAction(item.id, 'return')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20 transition-colors"><RotateCcw className="h-3.5 w-3.5" /> {t('returnAction')}</button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} totalPages={totalPages} pageSize={pageSize} setPage={setPage} onPageSizeChange={onPageSizeChange} t={t} />
    </div>
  );
}

function WfDetailModal({ item, onClose, t }: { item: WorkflowItem; onClose: () => void; t: (key: string) => string }) {
  const { data: detail } = useWorkflowDetail(item.id);
  const inst = detail?.data ?? item;
  const transitions = inst.transitions ?? [];
  const level = LEVEL_CONFIG[inst.currentLevel] ?? LEVEL_CONFIG.NATIONAL_TECHNICAL;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('workflowInstance')}</h2><p className="mt-0.5 text-xs text-gray-500 font-mono">{inst.id.slice(0, 8)}</p></div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-4">
          <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{t('currentStep')}</p><div className="mt-1 flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', level.dot)} /><span className={cn('text-sm font-medium', level.color)}>{level.shortLabel} - {t(level.label)}</span></div></div>
          <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{t('status')}</p><div className="mt-1"><StatusBadge status={inst.status} /></div></div>
          <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Domain</p><p className="mt-1 text-sm">{inst.domain}</p></div>
          <div><p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{t('date')}</p><p className="mt-1 text-sm">{formatDateTime(inst.createdAt)}</p></div>
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

function ActionDialog({ itemId, action, onClose, onConfirm, isPending, t }: {
  itemId: string; action: 'approve' | 'reject' | 'return'; onClose: () => void;
  onConfirm: (text: string) => void; isPending: boolean; t: (key: string) => string;
}) {
  const [text, setText] = useState('');
  const needsReason = action !== 'approve';
  const titles = { approve: t('validateSubmission'), reject: t('rejectSubmission'), return: t('returnForCorrection') };
  const btnColors = { approve: 'bg-green-600 hover:bg-green-700', reject: 'bg-red-600 hover:bg-red-700', return: 'bg-orange-600 hover:bg-orange-700' };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{titles[action]}</h3>
        <p className="mt-1 text-sm text-gray-500">ID: <span className="font-mono">{itemId.slice(0, 8)}</span></p>
        <div className="mt-4">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={action === 'reject' ? t('reasonForRejection') : action === 'return' ? t('whatNeedsCorrecting') : t('addCommentPlaceholder')}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300">{t('cancel')}</button>
          <button onClick={() => onConfirm(text)} disabled={isPending || (needsReason && !text.trim())}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50', btnColors[action])}>
            {isPending ? t('processing') : titles[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ total, page, totalPages, pageSize, setPage, onPageSizeChange, t }: {
  total: number; page: number; totalPages: number; pageSize: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  onPageSizeChange: (size: number) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-500">
          {total > 0 && <>{t('showing')} <span className="font-medium text-gray-700 dark:text-gray-300">{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)}</span> {t('of')} </>}
          <span className="font-medium">{total.toLocaleString()}</span>
        </p>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"><ChevronLeft className="h-4 w-4" /> {t('previous')}</button>
          <span className="text-sm font-medium text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">{t('next')} <ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
