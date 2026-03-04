'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Users,
  Play,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Globe,
  BarChart3,
  Pencil,
  Target,
  ClipboardEdit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCampaign,
  useUpdateCampaign,
  type CollecteCampaign,
} from '@/lib/api/hooks';
import {
  useFormBuilderTemplates,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { COUNTRIES } from '@/data/countries-config';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { TableSkeleton } from '@/components/ui/Skeleton';

// Fallback templates — same deterministic UUIDs as new/edit pages
const SEED_TEMPLATES: FormTemplateListItem[] = [
  { id: 'a0000001-0001-4000-8000-000000000001', tenantId: '', name: 'AU-IBAR Monthly Animal Health Report', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0002-4000-8000-000000000002', tenantId: '', name: 'Emergency Disease Reporting', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0003-4000-8000-000000000003', tenantId: '', name: 'Mass Vaccination', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0004-4000-8000-000000000004', tenantId: '', name: 'Meat Inspection', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0005-4000-8000-000000000005', tenantId: '', name: 'Monthly Abattoir Report', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'a0000001-0006-4000-8000-000000000006', tenantId: '', name: 'Monthly Vaccination Report', domain: 'animal_health', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0001-4000-8000-000000000007', tenantId: '', name: 'Animal Breeding and Genomics', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0002-4000-8000-000000000008', tenantId: '', name: 'Animal Population (Genetic Diversity)', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'b0000002-0003-4000-8000-000000000009', tenantId: '', name: 'Animal Population and Composition', domain: 'livestock', version: 1, status: 'PUBLISHED', dataClassification: 'RESTRICTED', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0001-4000-8000-00000000000e', tenantId: '', name: 'Cost of Production', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
  { id: 'c0000003-0002-4000-8000-00000000000f', tenantId: '', name: 'Import and Export', domain: 'trade_sps', version: 1, status: 'PUBLISHED', dataClassification: 'PARTNER', createdBy: 'system', publishedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', schema: null, uiSchema: null },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PLANNED: {
    label: 'Planned',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  CANCELLED: {
    label: 'Archived',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

function getDomainLabel(domain?: string): string {
  if (!domain) return '—';
  return DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const { data: campaignRes, isLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();

  const { data: templatesData } = useFormBuilderTemplates({ page: 1, limit: 100 });
  const apiTemplates = useMemo(() => templatesData?.data ?? [], [templatesData]);

  const campaign = (campaignRes as any)?.data as (CollecteCampaign & {
    progress?: {
      totalSubmissions: number;
      validated: number;
      rejected: number;
      pending: number;
      completionRate: number;
    };
  }) | undefined;

  // Resolve each campaign templateId to a { name, tpl, tplId } object.
  // Matching strategy: try ID match first (real DB IDs), then fall back to
  // name match via SEED_TEMPLATES (campaigns created when form-builder was offline
  // use hardcoded seed UUIDs that differ from the real DB UUIDs).
  const resolvedTemplates = useMemo(() => {
    if (!campaign) return [];
    const tplIds = campaign.templateIds ?? (campaign.templateId ? [campaign.templateId] : []);
    return tplIds.map((id) => {
      // 1. Direct ID match against API templates
      const byId = apiTemplates.find((t) => t.id === id);
      if (byId) return { name: byId.name, tpl: byId, tplId: id };

      // 2. Seed UUID → get name → match against API templates by name
      const seed = SEED_TEMPLATES.find((s) => s.id === id);
      if (seed) {
        const byName = apiTemplates.find((t) => t.name === seed.name);
        if (byName) return { name: seed.name, tpl: byName, tplId: id };
        // API offline — use seed for display (no schema)
        return { name: seed.name, tpl: seed, tplId: id };
      }

      return { name: id.slice(0, 8) + '...', tpl: undefined, tplId: id };
    });
  }, [campaign, apiTemplates]);

  const templateNames = useMemo(
    () => resolvedTemplates.map((r) => r.name),
    [resolvedTemplates],
  );

  // Resolve country info
  const countryInfos = useMemo(() => {
    if (!campaign) return [];
    return (campaign.targetCountries ?? []).map((code) => {
      const c = COUNTRIES[code.toUpperCase()];
      return c ? { code: c.code, name: c.name, flag: c.flag } : { code, name: code, flag: '' };
    });
  }, [campaign]);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link
            href="/collecte"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <div className="mt-2 h-8 w-64 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
        <TableSkeleton rows={6} cols={3} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4 pb-12">
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The campaign you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.PLANNED;
  const progress = campaign.progress;
  const totalSubmissions = progress?.totalSubmissions ?? campaign.totalSubmissions ?? 0;
  const validated = progress?.validated ?? campaign.validatedSubmissions ?? 0;
  const rejected = progress?.rejected ?? campaign.rejectedSubmissions ?? 0;
  const pending = totalSubmissions - validated - rejected;
  const target = campaign.targetSubmissions ?? 0;
  const pct = target > 0 ? Math.round((totalSubmissions / target) * 100) : 0;
  const agentCount = Array.isArray(campaign.assignedAgents) ? campaign.assignedAgents.length : 0;

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    try {
      await updateCampaign.mutateAsync({ id: campaignId, status: newStatus });
    } catch (err) {
      console.error('[CampaignDetail] Status change failed:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {campaign.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {campaign.description || 'No description provided'}
            </p>
          </div>
          <div className="ml-4 flex items-center gap-2 shrink-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
                statusCfg.bg,
                statusCfg.color,
              )}
            >
              {statusCfg.icon}
              {statusCfg.label}
            </span>

            {/* Status action buttons */}
            {campaign.status === 'PLANNED' && (
              <>
                <button
                  onClick={() => handleStatusChange('ACTIVE')}
                  disabled={updateCampaign.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Play className="h-3 w-3" /> Activate
                </button>
                <Link
                  href={`/collecte/campaigns/${campaignId}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Link>
              </>
            )}
            {campaign.status === 'ACTIVE' && (
              <button
                onClick={() => handleStatusChange('COMPLETED')}
                disabled={updateCampaign.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3 w-3" /> Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              Progress
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalSubmissions}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Submitted</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validated}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Validated</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rejected</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{totalSubmissions} / {target || '—'} submissions</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="flex h-full">
                  <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${target > 0 ? Math.min((validated / target) * 100, 100) : 0}%` }} />
                  <div className="bg-blue-300 dark:bg-blue-700 transition-all" style={{ width: `${target > 0 ? Math.min((pending / target) * 100, 100) : 0}%` }} />
                  {rejected > 0 && (
                    <div className="bg-red-400 dark:bg-red-600 transition-all" style={{ width: `${target > 0 ? Math.min((rejected / target) * 100, 100) : 0}%` }} />
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Validated ({validated})
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-300 dark:bg-blue-700" />
                  Pending ({pending})
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

          {/* Form Templates card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-gray-400" />
              Form Templates ({templateNames.length})
            </h3>
            {resolvedTemplates.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No templates assigned.</p>
            ) : (
              <div className="space-y-2">
                {resolvedTemplates.map((rt, i) => {
                  // Use the real DB ID for the submit link (so schema lookup works)
                  const linkId = rt.tpl?.id ?? rt.tplId;
                  return (
                    <div
                      key={rt.tplId ?? i}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50"
                    >
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{rt.name}</p>
                        {rt.tpl && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getDomainLabel(rt.tpl.domain)} &middot; v{rt.tpl.version}
                          </p>
                        )}
                      </div>
                      {campaign.status === 'ACTIVE' && linkId && (
                        <Link
                          href={`/collecte/campaigns/${campaignId}/submit/${linkId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shrink-0"
                        >
                          <ClipboardEdit className="h-3.5 w-3.5" />
                          Fill Form
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target Countries card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-gray-400" />
              Target Countries ({countryInfos.length})
            </h3>
            {countryInfos.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No countries specified.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {countryInfos.map((c) => (
                  <span
                    key={c.code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <span className="text-sm">{c.flag}</span>
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Campaign Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Campaign Info</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                <dd>
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', statusCfg.bg, statusCfg.color)}>
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Domain</dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{getDomainLabel(campaign.domain)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Start
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white">
                  {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> End
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white">
                  {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" /> Target
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{target || '—'} submissions</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Forms
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{templateNames.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> Countries
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{countryInfos.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Agents
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{agentCount}</dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
            <div className="space-y-2">
              {campaign.status === 'PLANNED' && (
                <>
                  <Link
                    href={`/collecte/campaigns/${campaignId}/edit`}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <Pencil className="h-4 w-4 text-gray-400" />
                    Edit Campaign
                  </Link>
                  <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    disabled={updateCampaign.isPending}
                    className="flex w-full items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {updateCampaign.isPending ? 'Activating...' : 'Activate Campaign'}
                  </button>
                </>
              )}
              {campaign.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => handleStatusChange('COMPLETED')}
                    disabled={updateCampaign.isPending}
                    className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {updateCampaign.isPending ? 'Completing...' : 'Mark as Complete'}
                  </button>
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={updateCampaign.isPending}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Archive
                  </button>
                </>
              )}
              {(campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                  No actions available for {statusCfg.label.toLowerCase()} campaigns.
                </p>
              )}
            </div>
          </div>

          {/* Country flags visual */}
          {countryInfos.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Coverage</h3>
              <div className="flex flex-wrap gap-1">
                {countryInfos.map((c) => (
                  <span key={c.code} className="text-lg" title={c.name}>
                    {c.flag}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {countryInfos.length} countr{countryInfos.length !== 1 ? 'ies' : 'y'} targeted
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
