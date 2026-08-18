'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  Share2,
  Layers,
  BarChart3,
  Trash2,
  Calendar,
  X,
  Home,
  Globe,
  Flag,
  LogIn,
  Lock,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDashboards,
  useCreateDashboard,
  useDeleteDashboard,
  type DashboardListItem,
  type DashboardOwnership,
  type DashboardScope,
} from '@/lib/api/dashboard-hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useSubDomains } from '@/hooks/use-sub-domains';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSettingsRecs, useSettingsCountries } from '@/lib/api/settings-hooks';
import { useCampaigns } from '@/lib/api/hooks';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { useTranslations } from '@/lib/i18n/translations';

type Tab = 'USER_OWNED' | 'SHARED' | 'SYSTEM_TEMPLATE';

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'USER_OWNED', label: 'My Dashboards', icon: LayoutDashboard },
  { key: 'SHARED', label: 'Shared with me', icon: Share2 },
  { key: 'SYSTEM_TEMPLATE', label: 'System Templates', icon: Layers },
];

const SCOPE_LABELS: Record<DashboardScope, string> = {
  CONTINENTAL: 'Continental',
  REC: 'REC',
  COUNTRY: 'Country',
  PERSONAL: 'Personal',
};

function DashboardCard({
  dashboard,
  onDelete,
  isShared,
}: {
  dashboard: DashboardListItem;
  onDelete?: (id: string) => void;
  isShared?: boolean;
}) {
  return (
    <div className="group relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/dashboards/${dashboard.id}`} className="block p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1F4E79]/10">
              <BarChart3 className="h-5 w-5 text-[#1F4E79]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-[#1F4E79] transition-colors">
                {dashboard.title}
              </h3>
              {dashboard.description && (
                <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                  {dashboard.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isShared && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Share2 className="h-3 w-3" />
                Shared with you
              </span>
            )}
            {dashboard.isDefault && (
              <span className="rounded-full bg-[#C9A227]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C9A227]">
                Default
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-medium">
            {SCOPE_LABELS[dashboard.scope] ?? dashboard.scope}
          </span>
          {dashboard.domainCode && (
            <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
              {dashboard.domainCode}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {dashboard.widgetCount} widget{dashboard.widgetCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(dashboard.updatedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Tags */}
        {dashboard.tags && dashboard.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {dashboard.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[10px] text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(dashboard.id);
          }}
          className="absolute right-2 top-2 rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all"
          title={t('deleteDashboard')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function MyDashboardsPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('USER_OWNED');

  const { data, isLoading } = useDashboards({
    ownership: activeTab as DashboardOwnership,
    limit: 50,
  });

  const createMutation = useCreateDashboard();
  const deleteMutation = useDeleteDashboard();
  const addToast = useRealtimeStore((s) => s.addToast);
  const allDomains = useDomainStore((s) => s.allDomains);
  const subDomainsMetadata = useDomainStore((s) => s.subDomainsMetadata);

  const dashboards: DashboardListItem[] = data?.data ?? [];

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // New dashboard modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [newZone, setNewZone] = useState<'principal' | 'domain' | 'subdomain' | 'campaign' | 'public_rec' | 'public_country'>(
    searchParams.get('domain') ? 'domain' : 'principal',
  );
  const [newDomainCode, setNewDomainCode] = useState(searchParams.get('domain') ?? '');
  const [newSubDomainCode, setNewSubDomainCode] = useState('');
  const [newCampaignId, setNewCampaignId] = useState('');
  const [newRecCode, setNewRecCode] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [treeSearch, setTreeSearch] = useState('');
  const [shakeModal, setShakeModal] = useState(false);

  // Multi-tenant context
  const user = useAuthStore((s) => s.user);
  const tenantLevel = user?.tenantLevel ?? 'CONTINENTAL';
  const isNational = tenantLevel === 'MEMBER_STATE';
  const isRec = tenantLevel === 'REC';

  // RECs and countries for public page selectors
  const { data: recsData } = useSettingsRecs({ limit: 20 });
  const allRecs: any[] = recsData?.data ?? [];
  const { data: countriesData } = useSettingsCountries({ limit: 100 });
  const allCountries: any[] = countriesData?.data ?? [];
  const { data: campaignsData } = useCampaigns({ limit: 100 });
  const allCampaigns: any[] = campaignsData?.data ?? [];

  const openCreateModal = () => {
    setNewTitle({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
    setNewZone(searchParams.get('domain') ? 'domain' : 'principal');
    setNewDomainCode(searchParams.get('domain') ?? '');
    setNewSubDomainCode('');
    setNewCampaignId('');
    setNewRecCode('');
    setNewCountryCode('');
    setTreeSearch('');
    setShowCreateModal(true);
  };

  const handleBackdropClick = () => {
    setShakeModal(true);
    setTimeout(() => setShakeModal(false), 300);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setShowCreateModal(false);
    try {
      let scope: DashboardScope = 'PERSONAL';
      let recCode: string | undefined;
      let countryCode: string | undefined;
      let campaignId: string | undefined;
      if (newZone === 'public_rec') {
        scope = 'REC';
        recCode = newRecCode;
      } else if (newZone === 'public_country') {
        scope = 'COUNTRY';
        countryCode = newCountryCode;
      } else if (newZone === 'campaign') {
        scope = 'CONTINENTAL';
        campaignId = newCampaignId;
      }

      const result = await createMutation.mutateAsync({
        titleFr: newTitle.fr || newTitle.en || 'Nouveau tableau de bord',
        titleEn: newTitle.en || newTitle.fr || 'New Dashboard',
        titlePt: newTitle.pt || undefined,
        titleAr: newTitle.ar || undefined,
        scope,
        domainCode: (newZone === 'domain' || newZone === 'subdomain') && newDomainCode ? newDomainCode : undefined,
        recCode,
        countryCode,
        campaignId,
      });
      const id = (result as any)?.data?.id;
      if (id) {
        router.push(`/dashboards/${id}/edit`);
      } else {
        setIsCreating(false);
      }
    } catch {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        addToast({
          type: 'success',
          title: t('deleteDashboard'),
          message: t('deleteConfirm'),
        });
        setDeleteTarget(null);
      },
      onError: (err: any) => {
        addToast({
          type: 'error',
          title: 'Erreur',
          message: err?.message || 'Impossible de supprimer le tableau de bord.',
        });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('myDashboards')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('myDashboardsSubtitle')}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#163a5c] disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('newDashboard')}
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800/50 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard grid */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/50"
              />
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <LayoutDashboard className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              {activeTab === 'USER_OWNED'
                ? 'No dashboards yet'
                : activeTab === 'SHARED'
                  ? 'No dashboards shared with you'
                  : 'No system templates available'}
            </p>
            {activeTab === 'USER_OWNED' && (
              <button
                onClick={openCreateModal}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#1F4E79] hover:underline"
              >
                <Plus className="h-4 w-4" />
                Create your first dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                onDelete={activeTab === 'USER_OWNED' ? handleDelete : undefined}
                isShared={activeTab === 'SHARED'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-screen loading overlay when creating dashboard */}
      {isCreating && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#1F4E79]" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            Creating dashboard...
          </p>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Supprimer le tableau de bord"
        message="Cette action est irreversible. Tous les widgets et configurations seront perdus."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      {/* Create Dashboard Modal — rendered via portal to cover sidebar */}
      {showCreateModal && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleBackdropClick}>
          <div
            className={cn(
              'mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800',
              shakeModal && 'animate-[shake_0.3s_ease-in-out]',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F4E79]/10">
                  <LayoutDashboard className="h-5 w-5 text-[#1F4E79]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau tableau de bord</h3>
                  <p className="text-xs text-gray-400">Configurez votre tableau de bord personnalise</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Title — multilingual with auto-translate */}
              <MultilingualInput
                label="Titre du tableau de bord"
                value={newTitle}
                onChange={setNewTitle}
                placeholder="Ex: Vue d'ensemble Santé animale..."
                required
              />

              {/* Zone — 3 options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Zone d&apos;affichage</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'principal' as const, icon: LogIn, label: 'Ouverture de session', desc: 'Tableau de bord principal', disabled: false },
                    { key: 'domain' as const, icon: Globe, label: 'Page domaine', desc: 'Specifique a un domaine', disabled: false },
                    { key: 'subdomain' as const, icon: Layers, label: 'Sous-domaine', desc: 'Specifique a un sous-domaine', disabled: false },
                    { key: 'campaign' as const, icon: ClipboardList, label: 'Campagne', desc: 'Lie a une campagne de collecte', disabled: false },
                    { key: 'public_rec' as const, icon: Globe, label: 'Page publique RECs', desc: 'Affiche sur la page REC', disabled: isNational },
                    { key: 'public_country' as const, icon: Flag, label: 'Page publique Pays', desc: 'Affiche sur la page pays', disabled: false },
                  ]).map((z) => (
                    <button
                      key={z.key}
                      type="button"
                      disabled={z.disabled}
                      onClick={() => {
                        if (z.disabled) return;
                        setNewZone(z.key);
                        setNewDomainCode('');
                        setNewSubDomainCode('');
                        setNewCampaignId('');
                        setNewRecCode('');
                        setNewCountryCode('');
                      }}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-medium transition-all',
                        z.disabled
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600'
                          : newZone === z.key
                            ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79] shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/50',
                      )}
                    >
                      {z.disabled && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-gray-300 dark:text-gray-600" />}
                      <z.icon className="h-5 w-5" />
                      <span>{z.label}</span>
                      <span className="text-[9px] font-normal text-gray-400">{z.disabled ? 'Niveau REC/Continental requis' : z.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Domain selector (zone=domain) */}
              {newZone === 'domain' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Domaine concerne</label>
                  <div className="grid grid-cols-1 gap-2">
                    {allDomains
                      .filter((d) => !['knowledge-hub', 'knowledge'].includes(d.code))
                      .map((d) => (
                      <button
                        key={d.code}
                        type="button"
                        onClick={() => setNewDomainCode(d.code)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                          newDomainCode === d.code
                            ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79] font-medium shadow-sm'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50',
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: d.color || '#1F4E79' }}>
                          {(d.name?.fr || d.name?.en || d.code).charAt(0).toUpperCase()}
                        </div>
                        <span>{d.name?.fr || d.name?.en || d.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-domain tree selector (zone=subdomain) */}
              {newZone === 'subdomain' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sous-domaine concerne</label>
                  <input
                    type="text"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                    placeholder="Rechercher un sous-domaine..."
                    className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <div className="max-h-[280px] overflow-y-auto space-y-1 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    {allDomains
                      .filter((d) => !['knowledge-hub', 'knowledge'].includes(d.code))
                      .map((domain) => {
                        const subs = subDomainsMetadata.filter((s) => s.domainCode === domain.code && s.active);
                        const q = treeSearch.toLowerCase();
                        const domainName = domain.name?.fr || domain.name?.en || domain.code;
                        const filteredSubs = q
                          ? subs.filter((s: any) => (s.labelFr || s.labelEn || s.code || '').toLowerCase().includes(q) || domainName.toLowerCase().includes(q))
                          : subs;
                        if (q && filteredSubs.length === 0 && !domainName.toLowerCase().includes(q)) return null;
                        return (
                          <div key={domain.code}>
                            {/* Domain header (not clickable) */}
                            <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: domain.color || '#1F4E79' }} />
                              {domainName}
                            </div>
                            {/* Sub-domains */}
                            {filteredSubs.length > 0 ? filteredSubs.map((sd: any) => (
                              <button
                                key={sd.code || sd.id}
                                type="button"
                                onClick={() => { setNewDomainCode(domain.code); setNewSubDomainCode(sd.code); }}
                                className={cn(
                                  'ml-4 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-all',
                                  newSubDomainCode === sd.code
                                    ? 'bg-[#1F4E79]/10 text-[#1F4E79] font-medium'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50',
                                )}
                              >
                                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: domain.color || '#1F4E79' }} />
                                {sd.labelFr || sd.labelEn || sd.code}
                              </button>
                            )) : (
                              <p className="ml-4 px-2.5 py-1.5 text-xs text-gray-400 italic">Aucun sous-domaine</p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Campaign selector (zone=campaign) */}
              {newZone === 'campaign' && (() => {
                const getCampaignName = (c: any): string => {
                  if (!c.name) return c.id;
                  if (typeof c.name === 'object') return c.name?.fr || c.name?.en || c.name?.pt || c.id;
                  return String(c.name);
                };
                const q = treeSearch.toLowerCase();
                const filtered = allCampaigns.filter((c: any) => {
                  if (!q) return true;
                  return getCampaignName(c).toLowerCase().includes(q) || (c.domain || '').toLowerCase().includes(q);
                });
                const STATUS_ORDER = ['ACTIVE', 'PLANNED', 'COMPLETED', 'CANCELLED'] as const;
                const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
                  ACTIVE: { label: 'Actives', dot: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
                  PLANNED: { label: 'Planifiees', dot: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
                  COMPLETED: { label: 'Terminees', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
                  CANCELLED: { label: 'Annulees', dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
                };
                const grouped = STATUS_ORDER.map((status) => ({
                  status,
                  config: STATUS_CONFIG[status] || STATUS_CONFIG.CANCELLED,
                  campaigns: filtered.filter((c: any) => c.status === status),
                })).filter((g) => g.campaigns.length > 0);

                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Campagne de collecte</label>
                    <input
                      type="text"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      placeholder="Rechercher une campagne..."
                      className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                    <div className="max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      {grouped.length > 0 ? grouped.map((group) => (
                        <div key={group.status}>
                          {/* Group header */}
                          <div className={cn('sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-700', group.config.bg)}>
                            <span className={cn('h-2 w-2 rounded-full shrink-0', group.config.dot)} />
                            <span className={cn('text-xs font-semibold uppercase tracking-wider', group.config.text)}>
                              {group.config.label}
                            </span>
                            <span className="ml-auto text-[10px] text-gray-400 font-medium">{group.campaigns.length}</span>
                          </div>
                          {/* Campaigns in group */}
                          {group.campaigns.map((c: any) => {
                            const name = getCampaignName(c);
                            const startDate = c.startDate ? new Date(c.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                            const endDate = c.endDate ? new Date(c.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setNewCampaignId(c.id)}
                                className={cn(
                                  'flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm border-b border-gray-50 dark:border-gray-800 last:border-b-0 transition-all',
                                  newCampaignId === c.id
                                    ? 'bg-[#1F4E79]/5 dark:bg-[#1F4E79]/20'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                                )}
                              >
                                {/* Status dot */}
                                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white dark:ring-gray-800', group.config.dot)} />
                                <div className="min-w-0 flex-1">
                                  <span className={cn(
                                    'block truncate',
                                    newCampaignId === c.id ? 'text-[#1F4E79] dark:text-[#C9A227] font-semibold' : 'text-gray-800 dark:text-gray-200',
                                  )}>{name}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {c.domain && (
                                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                        {c.domain}
                                      </span>
                                    )}
                                    {startDate && (
                                      <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                        <Calendar className="h-2.5 w-2.5" />
                                        {startDate} — {endDate}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {newCampaignId === c.id && (
                                  <span className="shrink-0 text-[#1F4E79] dark:text-[#C9A227]">✓</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )) : (
                        <p className="text-xs text-gray-400 italic px-3 py-6 text-center">Aucune campagne disponible</p>
                      )}
                    </div>
                    {/* Summary */}
                    {allCampaigns.length > 0 && (
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
                        {STATUS_ORDER.map((s) => {
                          const count = allCampaigns.filter((c: any) => c.status === s).length;
                          if (!count) return null;
                          return (
                            <span key={s} className="flex items-center gap-1">
                              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[s]?.dot || 'bg-gray-300')} />
                              {count} {STATUS_CONFIG[s]?.label.toLowerCase() || s.toLowerCase()}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* REC selector (zone=public_rec) */}
              {newZone === 'public_rec' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">REC concernee</label>
                  {isRec ? (
                    <div className="rounded-lg border border-[#1F4E79] bg-[#1F4E79]/5 px-3 py-2.5 text-sm text-[#1F4E79] font-medium">
                      {allRecs.find((r: any) => r.code === user?.tenantId || r.id === user?.tenantId)?.name?.en
                        ?? allRecs[0]?.name?.en ?? 'Your REC'}
                      <span className="ml-2 text-xs font-normal text-gray-400">(pre-selectionnee)</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                      {allRecs.map((rec: any) => (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => setNewRecCode(rec.code)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                            newRecCode === rec.code
                              ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79] font-medium shadow-sm'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50',
                          )}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: rec.accentColor || '#1F4E79' }}>
                            {(rec.name?.en || rec.code || '?').charAt(0)}
                          </div>
                          <span>{rec.name?.en ?? rec.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Country selector (zone=public_country) */}
              {newZone === 'public_country' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pays concerne</label>
                  {isNational ? (
                    <div className="rounded-lg border border-[#1F4E79] bg-[#1F4E79]/5 px-3 py-2.5 text-sm text-[#1F4E79] font-medium">
                      {allCountries.find((c: any) => c.tenantId === user?.tenantId)?.name?.en ?? 'Your Country'}
                      <span className="ml-2 text-xs font-normal text-gray-400">(pre-selectionnee)</span>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={treeSearch}
                        onChange={(e) => setTreeSearch(e.target.value)}
                        placeholder="Rechercher un pays..."
                        className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      />
                      <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto">
                        {allCountries
                          .filter((c: any) => {
                            if (!treeSearch.trim()) return true;
                            const q = treeSearch.toLowerCase();
                            return (c.name?.en || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q);
                          })
                          .map((c: any) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setNewCountryCode(c.code)}
                              className={cn(
                                'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                                newCountryCode === c.code
                                  ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79] font-medium shadow-sm'
                                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50',
                              )}
                            >
                              <span className="text-base">{c.flag}</span>
                              <span>{c.name?.en ?? c.code}</span>
                              <span className="ml-auto text-xs text-gray-400 font-mono">{c.code}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  (newZone === 'domain' && !newDomainCode) ||
                  (newZone === 'subdomain' && !newSubDomainCode) ||
                  (newZone === 'campaign' && !newCampaignId) ||
                  (newZone === 'public_rec' && !isRec && !newRecCode) ||
                  (newZone === 'public_country' && !isNational && !newCountryCode)
                }
                className="rounded-lg bg-[#1F4E79] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#163a5c] disabled:opacity-50"
              >
                Creer
              </button>
            </div>

            <style>{`
              @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-6px); }
                40% { transform: translateX(6px); }
                60% { transform: translateX(-4px); }
                80% { transform: translateX(4px); }
              }
            `}</style>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
