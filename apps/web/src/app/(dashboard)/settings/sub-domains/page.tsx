'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useAdminSubDomains,
  useUpdateSubDomain,
  useDeleteSubDomain,
  useAllDomains,
  useAllValueChainCodes,
} from '@/lib/api/sub-domain-hooks';
import type { SubDomainType } from '@/lib/stores/domain-store';
import { Pagination } from '@/components/ui/Pagination';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import { useTranslations } from '@/lib/i18n/translations';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  Network,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN']);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SubDomainsListPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <SubDomainsList />;
}

function SubDomainsList() {
  const t = useTranslations('settings');
  const addToast = useRealtimeStore((s) => s.addToast);

  const TYPE_BADGES: Record<SubDomainType, { bg: string; text: string; label: string }> = {
    VALUE_CHAIN:    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: t('typeValueChain') },
    ORGANIZATIONAL: { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',       label: t('typeOrganizational') },
    PATHOLOGY:      { bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-700 dark:text-red-400',         label: t('typePathology') },
    OTHER:          { bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-400',       label: t('typeOther') },
  };

  // Filters & pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [vcFilter, setVcFilter] = useState('');

  const { data: domainsData } = useAllDomains();
  const { data: vcData } = useAllValueChainCodes();
  const { data, isLoading } = useAdminSubDomains({
    page,
    limit,
    domainCode: domainFilter || undefined,
    typeEnum: (typeFilter as SubDomainType) || undefined,
    active: activeFilter || undefined,
    valueChainCode: vcFilter || undefined,
    search: search.trim() || undefined,
  });

  const updateMutation = useUpdateSubDomain();
  const deleteMutation = useDeleteSubDomain();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const domains = domainsData?.data ?? [];
  const valueChainCodes = vcData?.data ?? [];
  const subDomains = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit };

  const handleToggleActive = async (sd: (typeof subDomains)[0]) => {
    try {
      await updateMutation.mutateAsync({ id: sd.id, active: !sd.active });
      addToast({
        type: 'success',
        title: sd.active ? t('subDomainDeactivated') : t('subDomainActivated'),
        message: sd.active
          ? t('deactivatedMsg').replace('{code}', sd.code)
          : t('activatedMsg').replace('{code}', sd.code),
      });
    } catch {
      addToast({ type: 'error', title: t('error'), message: t('subDomainStatusError') });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deletingId);
      addToast({ type: 'success', title: t('subDomainDeleted'), message: t('subDomainDeletedMsg') });
      setDeletingId(null);
    } catch (err: any) {
      if (err?.statusCode === 409) {
        setDeleteError(err.message || t('subDomainUsedByEntities'));
      } else {
        addToast({ type: 'error', title: t('error'), message: t('subDomainDeleteError') });
        setDeletingId(null);
      }
    }
  };

  const deletingSubDomain = subDomains.find((sd) => sd.id === deletingId);

  const updateFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F4E79] to-[#1F4E79]/80 text-white shadow-sm">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('subDomainsTitle')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('subDomainsConfigured').replace('{count}', String(meta.total))}
            </p>
          </div>
        </div>
        <Link
          href="/settings/sub-domains/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1F4E79]/90"
        >
          <Plus className="h-4 w-4" />
          {t('btnNewSubDomain')}
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="search"
            value={search}
            onChange={(e) => updateFilter(setSearch)(e.target.value)}
            placeholder={t('searchSubDomains')}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <select value={domainFilter} onChange={(e) => updateFilter(setDomainFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">{t('allDomainsFilter')}</option>
          {domains.map((d) => <option key={d.code} value={d.code}>{d.name?.en ?? d.code}</option>)}
        </select>

        <select value={typeFilter} onChange={(e) => updateFilter(setTypeFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">{t('allTypesFilter')}</option>
          <option value="VALUE_CHAIN">{t('typeValueChain')}</option>
          <option value="ORGANIZATIONAL">{t('typeOrganizational')}</option>
          <option value="PATHOLOGY">{t('typePathology')}</option>
          <option value="OTHER">{t('typeOther')}</option>
        </select>

        <select value={vcFilter} onChange={(e) => updateFilter(setVcFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">{t('allChainsFilter')}</option>
          {valueChainCodes.map((vc) => <option key={vc.code} value={vc.code}>{vc.labelFr || vc.labelEn}</option>)}
        </select>

        <select value={activeFilter} onChange={(e) => updateFilter(setActiveFilter)(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
          <option value="">{t('allActiveInactive')}</option>
          <option value="true">{t('activeOnly2')}</option>
          <option value="false">{t('inactiveOnly2')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('code')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colParentDomain')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colLabelFrTable')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('indicatorType')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colValueChain')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colActive')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colOrderTable')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {subDomains.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        {t('noSubDomainsFound')}
                      </td>
                    </tr>
                  ) : (
                    subDomains.map((sd) => {
                      const badge = TYPE_BADGES[sd.typeEnum] ?? TYPE_BADGES.OTHER;
                      return (
                        <tr key={sd.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="px-4 py-3">
                            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {sd.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {(sd as any).domain?.name?.en ?? sd.domainCode}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{sd.labelFr}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {sd.valueChainCode ? (
                              <span className="inline-flex rounded-full bg-[#C9A227]/10 px-2 py-0.5 text-[11px] font-semibold text-[#C9A227]">
                                {sd.valueChainCode}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(sd)}
                              disabled={updateMutation.isPending}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                sd.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                              title={sd.active ? t('deactivateAction') : t('activateAction')}
                            >
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${sd.active ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{sd.displayOrder}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Link href={`/settings/sub-domains/${sd.id}`}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                title={t('edit')}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button type="button"
                                onClick={() => { setDeletingId(sd.id); setDeleteError(null); }}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                title={t('delete')}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {meta.total > 0 && (
              <Pagination
                page={page}
                total={meta.total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && deletingSubDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('deleteSubDomain')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('deleteSubDomainConfirm')
                    .replace('{code}', deletingSubDomain.code)
                    .replace('{label}', deletingSubDomain.labelFr)}
                </p>
                {deleteError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {deleteError}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setDeletingId(null); setDeleteError(null); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
