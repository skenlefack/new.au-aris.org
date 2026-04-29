'use client';

import React, { useState } from 'react';
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
}: {
  dashboard: DashboardListItem;
  onDelete?: (id: string) => void;
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
          {dashboard.isDefault && (
            <span className="rounded-full bg-[#C9A227]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C9A227]">
              Default
            </span>
          )}
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
          title="Delete dashboard"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function MyDashboardsPage() {
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

  const dashboards: DashboardListItem[] = data?.data ?? [];

  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // New dashboard modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newZone, setNewZone] = useState<'principal' | 'domain'>(
    searchParams.get('domain') ? 'domain' : 'principal',
  );
  const [newDomainCode, setNewDomainCode] = useState(searchParams.get('domain') ?? '');

  const openCreateModal = () => {
    setNewTitle('');
    setNewZone(searchParams.get('domain') ? 'domain' : 'principal');
    setNewDomainCode(searchParams.get('domain') ?? '');
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setShowCreateModal(false);
    try {
      const selectedDomain = allDomains.find((d) => d.code === newDomainCode);
      const result = await createMutation.mutateAsync({
        title: newTitle || 'New Dashboard',
        scope: 'PERSONAL',
        domainCode: newZone === 'domain' && newDomainCode ? newDomainCode : undefined,
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
          title: 'Dashboard supprime',
          message: 'Le tableau de bord a ete supprime avec succes.',
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
            My Dashboards
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Build custom dashboards with drag-and-drop widgets
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#163a5c] disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Dashboard
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-screen loading overlay when creating dashboard */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#1F4E79]" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            Creating dashboard...
          </p>
        </div>
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

      {/* Create Dashboard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau tableau de bord</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Mon tableau de bord..."
                  autoFocus
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              {/* Zone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zone d&apos;affichage</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewZone('principal')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all',
                      newZone === 'principal'
                        ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-400',
                    )}
                  >
                    <Home className="h-4 w-4" />
                    Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewZone('domain')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all',
                      newZone === 'domain'
                        ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-400',
                    )}
                  >
                    <Globe className="h-4 w-4" />
                    Domaine
                  </button>
                </div>
              </div>

              {/* Domain selector (only when zone=domain) */}
              {newZone === 'domain' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domaine</label>
                  <select
                    value={newDomainCode}
                    onChange={(e) => setNewDomainCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">-- Tous les domaines --</option>
                    {allDomains
                      .filter((d) => !['knowledge-hub', 'knowledge'].includes(d.code))
                      .map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name?.fr || d.name?.en || d.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                className="rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#163a5c]"
              >
                Creer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
