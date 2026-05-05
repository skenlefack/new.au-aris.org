'use client';

import React, { useMemo, useState, useCallback } from 'react';
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
  Eye,
  Download,
  Upload,
  X,
  FileSpreadsheet,
  Filter,
  Loader2,
  AlertCircle,
  FileDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCollectionCampaign,
  useUpdateCollectionCampaign,
  useActivateCampaign,
  useCompleteCampaign,
} from '@/lib/api/workflow-hooks';
import {
  useFormBuilderTemplates,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { COUNTRIES } from '@/data/countries-config';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore, type AuthUser } from '@/lib/stores/auth-store';
import { useLocaleStore } from '@/lib/stores/locale-store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCampaign = any;

function i18nStr(val: unknown, locale?: string): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    const lang = locale?.slice(0, 2) ?? 'en';
    return obj[lang] ?? obj['en'] ?? obj['fr'] ?? obj['pt'] ?? Object.values(obj).find((v) => v) ?? '';
  }
  return String(val);
}

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

// ── Permission helper — mirrors backend CollectionCampaignService.assertCanEdit ──
const LEVEL_RANK: Record<string, number> = { MEMBER_STATE: 1, COUNTRY: 1, REC: 2, CONTINENTAL: 3 };

function canEditCampaign(user: AuthUser | null, campaign: AnyCampaign): boolean {
  if (!user || !campaign) return false;
  const userRank = LEVEL_RANK[user.tenantLevel?.toUpperCase() ?? ''] ?? 0;
  const ownerRank = LEVEL_RANK[campaign.ownerType?.toUpperCase() ?? ''] ?? 0;
  if (userRank === 3) return true; // CONTINENTAL can edit all
  if (userRank < ownerRank) return false; // lower cannot edit higher
  if (userRank === ownerRank) return user.tenantId === campaign.ownerId;
  return true; // higher can edit lower (REC editing MS within scope — backend double-checks)
}

const STATUS_CONFIG: Record<string, { tKey: string; color: string; bg: string; icon: React.ReactNode }> = {
  PLANNED: {
    tKey: 'tabPlanned',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  ACTIVE: {
    tKey: 'tabActive',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  COMPLETED: {
    tKey: 'tabCompleted',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  CANCELLED: {
    tKey: 'tabArchived',
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
  const t = useTranslations('collecte');
  const locale = useLocaleStore((s) => s.locale);
  const campaignId = params.id as string;

  const { data: campaignRes, isLoading } = useCollectionCampaign(campaignId);
  const updateCampaign = useUpdateCollectionCampaign();
  const activateMut = useActivateCampaign();
  const completeMut = useCompleteCampaign();

  const { data: templatesData } = useFormBuilderTemplates({ page: 1, limit: 100 });
  const apiTemplates = useMemo(() => templatesData?.data ?? [], [templatesData]);

  const campaign = (campaignRes as AnyCampaign)?.data as AnyCampaign | undefined;

  const user = useAuthStore((s) => s.user);
  const editable = canEditCampaign(user, campaign);

  // Resolve each campaign templateId to a { name, tpl, tplId } object.
  // Matching strategy: try ID match first (real DB IDs), then fall back to
  // name match via SEED_TEMPLATES (campaigns created when form-builder was offline
  // use hardcoded seed UUIDs that differ from the real DB UUIDs).
  const resolvedTemplates = useMemo(() => {
    if (!campaign) return [];
    // Support multi-template: prefer formTemplateIds array, fallback to single formTemplateId
    const multiIds: string[] = Array.isArray(campaign.formTemplateIds) && campaign.formTemplateIds.length > 0
      ? campaign.formTemplateIds
      : [];
    const singleId = campaign.formTemplateId ?? campaign.templateId;
    const tplIds: string[] = multiIds.length > 0 ? multiIds : (singleId ? [singleId] : []);
    return tplIds.map((id: string) => {
      // 1. Direct ID match against API templates
      const byId = apiTemplates.find((tpl) => tpl.id === id);
      if (byId) return { name: byId.name, tpl: byId, tplId: id };

      // 2. Seed UUID → get name → match against API templates by name
      const seed = SEED_TEMPLATES.find((s) => s.id === id);
      if (seed) {
        const byName = apiTemplates.find((tpl) => tpl.name === seed.name);
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
  const countryInfos: { code: string; name: string; flag: string }[] = useMemo(() => {
    if (!campaign) return [];
    return (campaign.targetCountries ?? []).map((code: string) => {
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
            {t('backToCampaigns')}
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
          {t('backToCampaigns')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('campaignNotFound')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('campaignNotFoundDesc')}
        </p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.PLANNED;
  const progress = campaign.progress;
  const totalSubmissions = progress?.totalSubmissions ?? 0;
  const validated = 0; // CollectionCampaign tracks via assignments, not submission-level validation
  const rejected = 0;
  const pending = totalSubmissions - validated - rejected;
  const target = campaign.targetSubmissions ?? 0;
  const pct = progress?.completionRate ?? (target > 0 ? Math.round((totalSubmissions / target) * 100) : 0);
  const agentCount = progress?.totalAgents ?? (Array.isArray(campaign.assignments) ? campaign.assignments.length : 0);

  const [modalState, setModalState] = useState<{ type: 'export' | 'import' | null; tplId: string | null }>({ type: null, tplId: null });
  const modalTemplate = resolvedTemplates.find((rt) => rt.tplId === modalState.tplId);
  const closeModal = useCallback(() => setModalState({ type: null, tplId: null }), []);

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    try {
      if (newStatus === 'ACTIVE') {
        await activateMut.mutateAsync(campaignId);
      } else if (newStatus === 'COMPLETED') {
        await completeMut.mutateAsync(campaignId);
      } else {
        await updateCampaign.mutateAsync({ id: campaignId, status: newStatus } as AnyCampaign);
      }
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
          {t('backToCampaigns')}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {i18nStr(campaign.name, locale)}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {i18nStr(campaign.description, locale) || 'No description provided'}
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
              {t(statusCfg.tKey)}
            </span>

            {/* Status action buttons — only shown if user can edit this campaign */}
            {editable && campaign.status === 'PLANNED' && (
              <>
                <button
                  onClick={() => handleStatusChange('ACTIVE')}
                  disabled={activateMut.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Play className="h-3 w-3" /> {t('activate')}
                </button>
                <Link
                  href={`/collecte/campaigns/${campaignId}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Pencil className="h-3 w-3" /> {t('edit')}
                </Link>
              </>
            )}
            {editable && campaign.status === 'ACTIVE' && (
              <button
                onClick={() => handleStatusChange('COMPLETED')}
                disabled={completeMut.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3 w-3" /> {t('complete')}
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
              {t('progress')}
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalSubmissions}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('submitted')}</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validated}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('validated')}</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('rejected')}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{totalSubmissions} / {target || '—'} {t('submissions').toLowerCase()}</span>
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
                  {t('validated')} ({validated})
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-300 dark:bg-blue-700" />
                  {t('pending')} ({pending})
                </span>
                {rejected > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                    {t('rejected')} ({rejected})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Templates card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-gray-400" />
              {t('formTemplates')} ({templateNames.length})
            </h3>
            {resolvedTemplates.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noTemplatesAssigned')}</p>
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
                          {t('fillForm')}
                        </Link>
                      )}
                      {campaign.status === 'PLANNED' && linkId && (
                        <Link
                          href={`/collecte/campaigns/${campaignId}/submit/${linkId}?preview=1`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('previewForm')}
                        </Link>
                      )}
                      <button
                        onClick={() => setModalState({ type: 'export', tplId: rt.tplId })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export
                      </button>
                      <button
                        onClick={() => setModalState({ type: 'import', tplId: rt.tplId })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 shrink-0"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Import
                      </button>
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
              {t('targetCountries')} ({countryInfos.length})
            </h3>
            {countryInfos.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noCountriesSpecified')}</p>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('campaignInfo')}</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                <dd>
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', statusCfg.bg, statusCfg.color)}>
                    {statusCfg.icon}
                    {t(statusCfg.tKey)}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('domain')}</dt>
                {/* Backward compat: reads legacy domain field, prefer targets[] */}
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{getDomainLabel(campaign.domain)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {t('start')}
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white">
                  {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {t('end')}
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white">
                  {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" /> {t('target')}
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{target || '—'} {t('submissions').toLowerCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {t('forms')}
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{templateNames.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> {t('countries')}
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{countryInfos.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {t('agents')}
                </dt>
                <dd className="text-xs font-medium text-gray-900 dark:text-white">{agentCount}</dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
            <div className="space-y-2">
              {!editable && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                  {t('readOnlyCampaign')}
                </p>
              )}
              {editable && campaign.status === 'PLANNED' && (
                <>
                  <Link
                    href={`/collecte/campaigns/${campaignId}/edit`}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <Pencil className="h-4 w-4 text-gray-400" />
                    {t('editCampaign')}
                  </Link>
                  <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    disabled={activateMut.isPending}
                    className="flex w-full items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {activateMut.isPending ? t('activating') : t('activateCampaign')}
                  </button>
                </>
              )}
              {editable && campaign.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => handleStatusChange('COMPLETED')}
                    disabled={completeMut.isPending}
                    className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completeMut.isPending ? t('completing') : t('markAsComplete')}
                  </button>
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={updateCampaign.isPending}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    {t('archive')}
                  </button>
                </>
              )}
              {editable && (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                  {t('noActionsAvailable', { status: t(statusCfg.tKey).toLowerCase() })}
                </p>
              )}
            </div>
          </div>

          {/* Country flags visual */}
          {countryInfos.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('coverage')}</h3>
              <div className="flex flex-wrap gap-1">
                {countryInfos.map((c) => (
                  <span key={c.code} className="text-lg" title={c.name}>
                    {c.flag}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {countryInfos.length} {t('countries').toLowerCase()} {t('targeted')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {modalState.type === 'export' && modalTemplate?.tpl && (
        <CampaignExportModal
          onClose={closeModal}
          campaignId={campaignId}
          templateName={String(typeof modalTemplate.tpl.name === 'object' ? (modalTemplate.tpl.name as any).en || '' : modalTemplate.tpl.name || '')}
          schema={modalTemplate.tpl.schema}
        />
      )}

      {/* Import Modal */}
      {modalState.type === 'import' && modalTemplate?.tpl && (
        <CampaignImportModal
          onClose={closeModal}
          campaignId={campaignId}
          templateName={String(typeof modalTemplate.tpl.name === 'object' ? (modalTemplate.tpl.name as any).en || '' : modalTemplate.tpl.name || '')}
          schema={modalTemplate.tpl.schema}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INLINE MODALS — Export & Import
// ═══════════════════════════════════════════════════════════════

interface ModalField { code: string; label: string; type: string }

function extractFields(schema: unknown): ModalField[] {
  const s = schema as { sections?: { name?: { en?: string }; fields?: { code?: string; label?: { en?: string; fr?: string }; type?: string }[] }[] } | undefined;
  if (!s?.sections) return [];
  const rows: ModalField[] = [];
  for (const sec of s.sections) {
    for (const f of sec.fields || []) {
      if (f.code) rows.push({ code: f.code, label: f.label?.en || f.label?.fr || f.code, type: f.type || 'text' });
    }
  }
  return rows;
}

function CampaignExportModal({ onClose, campaignId, templateName, schema }: { onClose: () => void; campaignId: string; templateName: string; schema: unknown }) {
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const fields = useMemo(() => extractFields(schema), [schema]);
  const filterableFields = useMemo(() => fields.filter((f) => ['select', 'master-data-select', 'date', 'text', 'number'].includes(f.type)).slice(0, 8), [fields]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(`/api/v1/collecte/submissions?campaign=${campaignId}&limit=50000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const submissions: any[] = json?.data || [];
      if (submissions.length === 0) { setError('No data to export'); setExporting(false); return; }

      // Apply filters
      let filtered = submissions;
      for (const [key, val] of Object.entries(filters)) {
        if (val) filtered = filtered.filter((s: any) => String(s.data?.[key] ?? '').toLowerCase().includes(val.toLowerCase()));
      }

      if (format === 'json') {
        download(new Blob([JSON.stringify(filtered.map((s: any) => s.data), null, 2)], { type: 'application/json' }), `${templateName}_export.json`);
      } else if (format === 'csv') {
        const headers = fields.map((f) => f.code);
        const csv = [headers.join(','), ...filtered.map((s: any) => headers.map((h) => `"${String(s.data?.[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
        download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `${templateName}_export.csv`);
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Data');
        const hr = ws.addRow(fields.map((f) => f.label));
        hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; });
        for (const sub of filtered) ws.addRow(fields.map((f) => sub.data?.[f.code] ?? ''));
        ws.columns.forEach((col, i) => { col.width = Math.max(12, (fields[i]?.label.length ?? 10) + 4); });
        const buf = await wb.xlsx.writeBuffer();
        download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${templateName}_export.xlsx`);
      }
      onClose();
    } catch (err: any) { setError(err?.message || 'Export failed'); } finally { setExporting(false); }
  }, [campaignId, format, filters, fields, templateName, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <Download className="h-5 w-5" />
            <div><h2 className="text-base font-semibold">Export Data</h2><p className="text-xs text-blue-100">{templateName}</p></div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Format</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['xlsx', 'csv', 'json'] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-medium', format === f ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400')}>
                  <FileSpreadsheet className="h-5 w-5" />{f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {filterableFields.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Filters</label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {filterableFields.map((f) => (
                  <div key={f.code} className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-28 truncate shrink-0">{f.label}</label>
                    <input type="text" placeholder={`Filter...`} value={filters[f.code] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.code]: e.target.value }))} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 px-3 py-2"><AlertCircle className="h-4 w-4 text-red-500" /><p className="text-xs text-red-600">{error}</p></div>}
        </div>
        <div className="border-t px-6 py-4 flex justify-between bg-gray-50 dark:bg-gray-800/50">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignImportModal({ onClose, campaignId, templateName, schema }: { onClose: () => void; campaignId: string; templateName: string; schema: unknown }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const fields = useMemo(() => extractFields(schema), [schema]);

  const handleGenTemplate = useCallback(async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Entry', { views: [{ state: 'frozen', ySplit: 1 }] });
    const hr = ws.addRow(fields.map((f) => f.code));
    hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; });
    ws.addRow(fields.map((f) => f.label)); // row 2 = labels for reference
    for (let i = 0; i < 50; i++) ws.addRow([]);
    ws.columns.forEach((col, i) => { col.width = Math.max(14, (fields[i]?.label.length ?? 10) + 4); });
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `ARIS_Template_${templateName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }, [fields, templateName]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true); setError(''); setResult(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) { setError('File is empty'); setImporting(false); return; }
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? '').trim(); });
      const startRow = fields.some((f) => f.label === String(ws.getRow(2).getCell(1).value ?? '')) ? 3 : 2;
      const rows: Record<string, unknown>[] = [];
      for (let r = startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const d: Record<string, unknown> = {};
        let hasVal = false;
        headers.forEach((h, i) => { if (!h) return; const v = row.getCell(i + 1).value; if (v != null && v !== '') { d[h] = v; hasVal = true; } });
        if (hasVal) rows.push(d);
      }
      if (rows.length === 0) { setError('No data rows found'); setImporting(false); return; }
      const token = localStorage.getItem('accessToken') || '';
      let success = 0, errors = 0;
      for (let i = 0; i < rows.length; i += 20) {
        const batch = rows.slice(i, i + 20);
        await Promise.all(batch.map((data) => fetch('/api/v1/collecte/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ campaignId, data }) }).then((r) => { if (r.ok) success++; else errors++; }).catch(() => { errors++; })));
      }
      setResult({ success, errors, total: rows.length });
    } catch (err: any) { setError(err?.message || 'Import failed'); } finally { setImporting(false); }
  }, [file, campaignId, fields]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center gap-3 text-white">
            <Upload className="h-5 w-5" />
            <div><h2 className="text-base font-semibold">Import Data</h2><p className="text-xs text-emerald-100">{templateName}</p></div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <button onClick={handleGenTemplate} className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10 p-4 hover:bg-emerald-100">
            <FileDown className="h-8 w-8 text-emerald-500" />
            <div className="text-left"><p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Download Reference Template</p><p className="text-xs text-emerald-600/70">{fields.length} fields ready for data entry</p></div>
          </button>
          <div className={cn('rounded-xl border-2 border-dashed p-8 text-center', file ? 'border-green-300 bg-green-50' : 'border-gray-300')}>
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <button onClick={() => { setFile(null); setResult(null); }} className="text-xs text-red-500">Remove</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-gray-400" />
                <p className="text-sm text-gray-600">Drag & drop or select a file</p>
                <label className="cursor-pointer rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200">
                  Browse<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); setError(''); } }} className="hidden" />
                </label>
              </div>
            )}
          </div>
          {result && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-2"><Check className="h-4 w-4 text-green-600" /><span className="text-sm font-medium">Import Complete</span></div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-bold">{result.total}</p><p className="text-[10px] text-gray-500 uppercase">Total</p></div>
                <div><p className="text-lg font-bold text-green-600">{result.success}</p><p className="text-[10px] text-gray-500 uppercase">Success</p></div>
                <div><p className="text-lg font-bold text-red-600">{result.errors}</p><p className="text-[10px] text-gray-500 uppercase">Errors</p></div>
              </div>
            </div>
          )}
          {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"><AlertCircle className="h-4 w-4 text-red-500" /><p className="text-xs text-red-600">{error}</p></div>}
        </div>
        <div className="border-t px-6 py-4 flex justify-between bg-gray-50 dark:bg-gray-800/50">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600">{result ? 'Close' : 'Cancel'}</button>
          {!result && <button onClick={handleImport} disabled={!file || importing} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{importing ? 'Importing...' : 'Import'}
          </button>}
        </div>
      </div>
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
