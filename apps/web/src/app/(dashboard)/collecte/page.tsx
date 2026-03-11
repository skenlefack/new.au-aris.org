'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  ClipboardList,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ArrowUpDown,
  FileText,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  Globe,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCampaigns,
  useUpdateCampaign,
  useDeleteCampaign,
  type CollecteCampaign,
} from '@/lib/api/hooks';
import { COUNTRIES } from '@/data/countries-config';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { TableSkeleton } from '@/components/ui/Skeleton';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }
> = {
  PLANNED: {
    label: 'Planned',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    dot: 'bg-amber-500',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    dot: 'bg-green-500',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    dot: 'bg-blue-500',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  CANCELLED: {
    label: 'Archived',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700',
    dot: 'bg-gray-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  key: string;
  label: string;
  statuses: string[];
}

const TABS: TabDef[] = [
  { key: 'active', label: 'Active', statuses: ['ACTIVE'] },
  { key: 'planned', label: 'Planned', statuses: ['PLANNED'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'archived', label: 'Archived', statuses: ['CANCELLED'] },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'ending_soon', label: 'Ending Soon' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCountryFlags(campaign: CollecteCampaign): string[] {
  const countries = campaign.targetCountries ?? [];
  return countries
    .map((c) => COUNTRIES[c.toUpperCase()]?.flag ?? null)
    .filter(Boolean) as string[];
}

function getCountryCount(campaign: CollecteCampaign): number {
  return (campaign.targetCountries ?? campaign.targetZones ?? []).length;
}

function getFormCount(campaign: CollecteCampaign): number {
  return (campaign.templateIds ?? (campaign.templateId ? [campaign.templateId] : [])).length;
}

function getDomainLabel(domain?: string): string {
  if (!domain) return '';
  return DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain;
}

// ─── Archive Modal ────────────────────────────────────────────────────────────

function ArchiveModal({
  campaign,
  onConfirm,
  onCancel,
  isPending,
}: {
  campaign: CollecteCampaign;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Archive Campaign</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{campaign.name}</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Reason for archiving <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Campaign objectives met, budget constraints..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  campaign,
  onConfirm,
  onCancel,
  isPending,
}: {
  campaign: CollecteCampaign;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete Campaign</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{campaign.name}</strong>?
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Actions dropdown ─────────────────────────────────────────────────────────

function CampaignActions({
  campaign,
  onEdit,
  onDelete,
  onArchive,
}: {
  campaign: CollecteCampaign;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const canDelete = campaign.status === 'PLANNED';
  const canArchive = campaign.status === 'ACTIVE';
  const canEdit = campaign.status === 'PLANNED';

  if (!canDelete && !canArchive && !canEdit) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {canEdit && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {canArchive && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onArchive(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
            )}
            {canDelete && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Card View ────────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onEdit,
  onDelete,
  onArchive,
}: {
  campaign: CollecteCampaign;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.PLANNED;
  const total = campaign.totalSubmissions ?? 0;
  const validated = campaign.validatedSubmissions ?? 0;
  const rejected = campaign.rejectedSubmissions ?? 0;
  const target = campaign.targetSubmissions ?? 0;
  const agentCount = Array.isArray(campaign.assignedAgents) ? campaign.assignedAgents.length : (campaign.assignedAgents ?? 0);
  const progress = target > 0 ? Math.round((total / target) * 100) : 0;
  const flags = getCountryFlags(campaign);
  const countryCount = getCountryCount(campaign);
  const formCount = getFormCount(campaign);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-lg hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600">
      {/* Header with gradient accent */}
      <div className="relative p-5 pb-3">
        <div className="flex items-start justify-between">
          <Link href={`/collecte/campaigns/${campaign.id}`} className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-aris-primary-600 dark:group-hover:text-aris-primary-400 transition-colors">
              {campaign.name}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {campaign.description || 'No description'}
            </p>
          </Link>
          <div className="ml-3 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                statusCfg.bg, statusCfg.color,
              )}
            >
              {statusCfg.icon}
              {statusCfg.label}
            </span>
            <CampaignActions campaign={campaign} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <Link href={`/collecte/campaigns/${campaign.id}`} className="flex-1 px-5 space-y-3">
        {/* Domain badge */}
        {campaign.domain && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {getDomainLabel(campaign.domain)}
          </span>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1" title="Forms">
            <FileText className="h-3.5 w-3.5" />
            {formCount} form{formCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1" title="Countries">
            <Globe className="h-3.5 w-3.5" />
            {countryCount} countr{countryCount !== 1 ? 'ies' : 'y'}
          </span>
          <span className="flex items-center gap-1" title="Agents">
            <Users className="h-3.5 w-3.5" />
            {agentCount}
          </span>
        </div>

        {/* Countries flags */}
        {flags.length > 0 && (
          <div className="flex items-center gap-0.5">
            {flags.slice(0, 10).map((flag, i) => (
              <span key={i} className="text-sm leading-none">{flag}</span>
            ))}
            {flags.length > 10 && (
              <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                +{flags.length - 10}
              </span>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(campaign.startDate).toLocaleDateString()} — {new Date(campaign.endDate).toLocaleDateString()}
        </div>
      </Link>

      {/* Footer — progress */}
      <div className="mt-auto border-t border-gray-100 p-5 pt-4 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>{total} / {target || '—'} submissions</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div className="flex h-full">
            <div className="bg-aris-primary-500 rounded-l-full transition-all" style={{ width: `${target > 0 ? Math.min((validated / target) * 100, 100) : 0}%` }} />
            <div className="bg-aris-primary-200 dark:bg-aris-primary-800 transition-all" style={{ width: `${target > 0 ? Math.min(((total - validated - rejected) / target) * 100, 100) : 0}%` }} />
            {rejected > 0 && (
              <div className="bg-red-400 dark:bg-red-600 transition-all" style={{ width: `${target > 0 ? Math.min((rejected / target) * 100, 100) : 0}%` }} />
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-aris-primary-500" />
            Validated ({validated})
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-aris-primary-200 dark:bg-aris-primary-800" />
            Pending ({total - validated - rejected})
          </span>
          {rejected > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              Rejected ({rejected})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function CampaignListRow({
  campaign,
  onEdit,
  onDelete,
  onArchive,
}: {
  campaign: CollecteCampaign;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.PLANNED;
  const total = campaign.totalSubmissions ?? 0;
  const target = campaign.targetSubmissions ?? 0;
  const progress = target > 0 ? Math.round((total / target) * 100) : 0;
  const countryCount = getCountryCount(campaign);
  const formCount = getFormCount(campaign);
  const agentCount = Array.isArray(campaign.assignedAgents) ? campaign.assignedAgents.length : (campaign.assignedAgents ?? 0);
  const flags = getCountryFlags(campaign);

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 transition-all hover:shadow-md hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600">
      {/* Status dot */}
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', statusCfg.dot)} />

      {/* Name + description */}
      <Link href={`/collecte/campaigns/${campaign.id}`} className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-aris-primary-600 dark:group-hover:text-aris-primary-400 transition-colors">
          {campaign.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {getDomainLabel(campaign.domain)} {campaign.description ? `— ${campaign.description}` : ''}
        </p>
      </Link>

      {/* Stats badges */}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title="Forms">
          <FileText className="h-3.5 w-3.5" />
          {formCount}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title="Countries">
          <Globe className="h-3.5 w-3.5" />
          {countryCount}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title="Agents">
          <Users className="h-3.5 w-3.5" />
          {agentCount}
        </span>
      </div>

      {/* Flags */}
      <div className="hidden lg:flex items-center gap-0.5 shrink-0">
        {flags.slice(0, 5).map((flag, i) => (
          <span key={i} className="text-sm leading-none">{flag}</span>
        ))}
        {flags.length > 5 && (
          <span className="ml-0.5 text-[10px] text-gray-400">+{flags.length - 5}</span>
        )}
      </div>

      {/* Dates */}
      <div className="hidden xl:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0">
        <Calendar className="h-3.5 w-3.5" />
        {new Date(campaign.startDate).toLocaleDateString()} — {new Date(campaign.endDate).toLocaleDateString()}
      </div>

      {/* Progress */}
      <div className="w-24 shrink-0 hidden sm:block">
        <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
          <span>{total}/{target || '—'}</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div className="h-full bg-aris-primary-500 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      {/* Status badge */}
      <span
        className={cn(
          'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
          statusCfg.bg, statusCfg.color,
        )}
      >
        {statusCfg.label}
      </span>

      {/* Actions */}
      <CampaignActions campaign={campaign} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('planned');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<CollecteCampaign | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CollecteCampaign | null>(null);

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const { data, isLoading } = useCampaigns({ page, limit: 100, search: search || undefined });
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const allCampaigns = data?.data ?? [];

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of TABS) {
      counts[tab.key] = allCampaigns.filter((c) => tab.statuses.includes(c.status)).length;
    }
    return counts;
  }, [allCampaigns]);

  const filteredCampaigns = useMemo(() => {
    let list = allCampaigns.filter((c) => currentTab.statuses.includes(c.status));

    if (domainFilter) {
      list = list.filter((c) => c.domain === domainFilter);
    }

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'ending_soon':
          return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return list;
  }, [allCampaigns, currentTab, domainFilter, sort]);

  const handleEdit = useCallback((c: CollecteCampaign) => {
    router.push(`/collecte/campaigns/${c.id}/edit`);
  }, [router]);

  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionError(null);
    console.log('[Collecte] Deleting campaign:', deleteTarget.id, deleteTarget.name);
    try {
      await deleteCampaign.mutateAsync(deleteTarget.id);
      console.log('[Collecte] Delete success');
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Collecte] Delete failed:', err);
      setActionError(`Delete failed: ${msg}`);
    }
  }, [deleteTarget, deleteCampaign]);

  const handleArchive = useCallback(async (reason: string) => {
    if (!archiveTarget) return;
    setActionError(null);
    try {
      await updateCampaign.mutateAsync({
        id: archiveTarget.id,
        status: 'CANCELLED',
        description: `${archiveTarget.description ?? ''}\n\n[Archived] ${reason}`.trim(),
      });
      setArchiveTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Collecte] Archive failed:', err);
      setActionError(`Archive failed: ${msg}`);
    }
  }, [archiveTarget, updateCampaign]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collecte</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Campaign orchestration and data collection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/collecte/forms"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ClipboardList className="h-4 w-4" />
            Form Builder
          </Link>
          <Link
            href="/collecte/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={cn(
                'relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-aris-primary-500 text-aris-primary-600 dark:text-aris-primary-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  activeTab === tab.key
                    ? 'bg-aris-primary-100 text-aris-primary-700 dark:bg-aris-primary-900/40 dark:text-aris-primary-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                {tabCounts[tab.key] ?? 0}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={domainFilter}
          onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All Domains</option>
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-4 w-4 text-gray-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center justify-center p-2 transition-colors',
              viewMode === 'grid'
                ? 'bg-aris-primary-50 text-aris-primary-600 dark:bg-aris-primary-900/30 dark:text-aris-primary-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            )}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center justify-center p-2 transition-colors border-l border-gray-300 dark:border-gray-600',
              viewMode === 'list'
                ? 'bg-aris-primary-50 text-aris-primary-600 dark:bg-aris-primary-900/30 dark:text-aris-primary-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Campaign listing */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : filteredCampaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <ClipboardList className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            {search ? 'No campaigns match your search' : 'No campaigns in this tab'}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {activeTab === 'planned'
              ? 'Create your first data collection campaign to get started.'
              : 'Campaigns will appear here when their status changes.'}
          </p>
          {(activeTab === 'planned' || activeTab === 'active') && (
            <Link
              href="/collecte/campaigns/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => handleEdit(campaign)}
              onDelete={() => setDeleteTarget(campaign)}
              onArchive={() => setArchiveTarget(campaign)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCampaigns.map((campaign) => (
            <CampaignListRow
              key={campaign.id}
              campaign={campaign}
              onEdit={() => handleEdit(campaign)}
              onDelete={() => setDeleteTarget(campaign)}
              onArchive={() => setArchiveTarget(campaign)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {deleteTarget && (
        <DeleteModal
          campaign={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteCampaign.isPending}
        />
      )}
      {archiveTarget && (
        <ArchiveModal
          campaign={archiveTarget}
          onConfirm={handleArchive}
          onCancel={() => setArchiveTarget(null)}
          isPending={updateCampaign.isPending}
        />
      )}
    </div>
  );
}
