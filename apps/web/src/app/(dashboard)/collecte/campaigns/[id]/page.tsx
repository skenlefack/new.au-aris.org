'use client';

import React, { useMemo, useState } from 'react';
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
  Puzzle,
  FlaskConical,
  LayoutDashboard,
  Plus,
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
import LabResultsTab, { detectLabRepeaters } from '@/components/collecte/LabResultsTab';
import dynamic from 'next/dynamic';

const DigitalToolsDashboard = dynamic(
  () => import('@/components/collecte/DigitalToolsDashboard'),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

const DiagnosticsDashboard = dynamic(
  () => import('@/components/collecte/DiagnosticsDashboard'),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);

const GenericCampaignDashboard = dynamic(
  () => import('@/components/collecte/GenericCampaignDashboard'),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" /> },
);
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore, type AuthUser } from '@/lib/stores/auth-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import {
  useDashboards,
  useCreateDashboard,
  type DashboardListItem,
} from '@/lib/api/dashboard-hooks';

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

  const [activeTab, setActiveTab] = useState<'details' | 'lab-results' | 'dashboards'>('details');

  // Detect if any template has lab-processable repeaters
  const labTemplates = useMemo(() => {
    return resolvedTemplates.filter((rt) => {
      if (!rt.tpl?.schema) return false;
      const schema = rt.tpl.schema as Record<string, unknown>;
      if (!schema.sections || !Array.isArray(schema.sections)) return false;
      return detectLabRepeaters(schema as never).length > 0;
    });
  }, [resolvedTemplates]);

  const hasLabTab = labTemplates.length > 0;

  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.PLANNED;
  const progress = campaign.progress;
  const totalSubmissions = progress?.totalSubmissions ?? 0;
  const validated = 0; // CollectionCampaign tracks via assignments, not submission-level validation
  const rejected = 0;
  const pending = totalSubmissions - validated - rejected;
  const target = campaign.targetSubmissions ?? 0;
  const pct = progress?.completionRate ?? (target > 0 ? Math.round((totalSubmissions / target) * 100) : 0);
  const agentCount = progress?.totalAgents ?? (Array.isArray(campaign.assignments) ? campaign.assignments.length : 0);

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
              {i18nStr(campaign.description, locale) || t('noDescriptionProvided')}
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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('details')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'details'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          {t('campaignInfo')}
        </button>
        {hasLabTab && (
          <button
            onClick={() => setActiveTab('lab-results')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
              activeTab === 'lab-results'
                ? 'border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <FlaskConical className="h-4 w-4" />
            Résultats Laboratoire
          </button>
        )}
        <button
          onClick={() => setActiveTab('dashboards')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
            activeTab === 'dashboards'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Tableaux de bord
        </button>
      </div>

      {/* Lab Results Tab */}
      {activeTab === 'lab-results' && hasLabTab && labTemplates.map((lt) => (
        <LabResultsTab
          key={lt.tplId}
          campaignId={campaignId}
          templateId={lt.tpl!.id}
          templateSchema={lt.tpl!.schema as never}
          locale={locale}
        />
      ))}

      {/* Dashboards Tab */}
      {activeTab === 'dashboards' && (
        <CampaignDashboardsTab campaignId={campaignId} campaignName={i18nStr(campaign.name, locale)} />
      )}

      {/* Content grid — Details tab */}
      {activeTab === 'details' && <div className="grid gap-6 lg:grid-cols-3">
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
                      <Link
                        href={`/collecte/campaigns/${campaignId}/export/${linkId}?view=1`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('view') || 'View'}
                      </Link>
                      <Link
                        href={`/collecte/campaigns/${campaignId}/export/${linkId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 shrink-0"
                      >
                        {t('export')}
                      </Link>
                      <Link
                        href={`/collecte/campaigns/${campaignId}/import/${linkId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 shrink-0"
                      >
                        {t('import')}
                      </Link>
                      {/* Extend button: REC/Country admins can add custom fields */}
                      {linkId && (user?.tenantLevel === 'REC' || user?.tenantLevel === 'MEMBER_STATE') && (
                        <Link
                          href={`/collecte/forms/${linkId}/extend?campaignId=${campaignId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-400 shrink-0"
                          title={t('extendTooltip')}
                        >
                          <Puzzle className="h-3.5 w-3.5" />
                          {t('extend')}
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
                <dt className="text-gray-500 dark:text-gray-400">{t('status')}</dt>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('actions')}</h3>
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
      </div>}
    </div>
  );
}

/* ── Campaign Dashboards Tab ─────────────────────────────────────────────── */

function CampaignDashboardsTab({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const router = useRouter();
  const { data, isLoading } = useDashboards({ campaignId, limit: 50 });
  const dashboards: DashboardListItem[] = data?.data ?? [];
  const createMutation = useCreateDashboard();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createMutation.mutateAsync({
        title: `Dashboard — ${campaignName}`,
        scope: 'CONTINENTAL',
        campaignId,
      });
      const id = (result as any)?.data?.id;
      if (id) router.push(`/dashboards/${id}/edit`);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const hasLinkedDashboards = !isLoading && dashboards.length > 0;

  const renderCampaignDashboard = (cId: string, cName: string) => {
    const nameLower = cName.toLowerCase();
    // Allocation Kits → uses linked dashboard builder dashboard only (no custom component)
    if (nameLower.includes('allocation') && nameLower.includes('kit')) {
      return null;
    }
    // Surveillance & Outils Numériques → custom digital tools dashboard
    if (nameLower.includes('surveillance') && (nameLower.includes('outil') || nameLower.includes('numérique') || nameLower.includes('numerique'))) {
      return <DigitalToolsDashboard campaignId={cId} />;
    }
    // Tests Diagnostiques & HPPR-bELISA → custom diagnostics dashboard
    if (nameLower.includes('diagnostic') || nameLower.includes('hppr') || nameLower.includes('belisa')) {
      return <DiagnosticsDashboard campaignId={cId} />;
    }
    // All other campaigns → generic auto-generated dashboard
    return <GenericCampaignDashboard campaignId={cId} campaignName={cName} />;
  };

  return (
    <div className="space-y-6">
      {/* Custom visual dashboard — rendered from live submission data */}
      {renderCampaignDashboard(campaignId, campaignName)}

      {/* Dashboard builder dashboards linked to this campaign */}
      {hasLinkedDashboards && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {dashboards.length === 1 ? 'Tableau de bord' : `Tableaux de bord (${dashboards.length})`}
            </h3>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-[#1F4E79] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#163a5c] disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((d) => (
              <Link
                key={d.id}
                href={`/dashboards/${d.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
                    <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-[#1F4E79] transition-colors truncate">
                      {d.title}
                    </h3>
                    {d.description && (
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{d.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                  <span>{d.widgetCount} widget{d.widgetCount !== 1 ? 's' : ''}</span>
                  <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create button when no builder dashboards yet */}
      {!isLoading && dashboards.length === 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Créer un tableau de bord personnalisé
          </button>
        </div>
      )}
    </div>
  );
}
