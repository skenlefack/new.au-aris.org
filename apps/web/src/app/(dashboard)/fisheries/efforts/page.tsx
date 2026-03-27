'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useFishingEfforts,
  useCreateEffort,
  useUpdateEffort,
  useDeleteEffort,
  type FishingEffort,
} from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const PLACEHOLDER_EFFORTS: FishingEffort[] = [
  {
    id: 'eff-1',
    vesselId: 'v-1',
    vesselName: 'Atlas Pelagic',
    effortType: 'Days at Sea',
    effortValue: 145,
    effortUnit: 'days',
    gearType: 'Purse seine',
    crewSize: 18,
    startDate: '2025-07-01',
    endDate: '2025-12-31',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-10T08:00:00Z',
  },
  {
    id: 'eff-2',
    vesselId: 'v-2',
    vesselName: 'Nile Explorer',
    effortType: 'Hours Fished',
    effortValue: 2400,
    effortUnit: 'hours',
    gearType: 'Gillnet',
    crewSize: 8,
    startDate: '2025-06-01',
    endDate: '2025-11-30',
    createdAt: '2025-12-01T09:00:00Z',
    updatedAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'eff-3',
    vesselId: 'v-3',
    vesselName: 'Cape Fisher',
    effortType: 'Trawl Hours',
    effortValue: 980,
    effortUnit: 'hours',
    gearType: 'Bottom trawl',
    crewSize: 22,
    startDate: '2025-09-01',
    endDate: '2026-02-28',
    createdAt: '2026-01-20T08:00:00Z',
    updatedAt: '2026-03-01T14:00:00Z',
  },
  {
    id: 'eff-4',
    vesselId: 'v-4',
    vesselName: 'Dakar Star',
    effortType: 'Days at Sea',
    effortValue: 210,
    effortUnit: 'days',
    gearType: 'Longline',
    crewSize: 12,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    createdAt: '2026-01-08T07:00:00Z',
    updatedAt: '2026-01-30T11:00:00Z',
  },
  {
    id: 'eff-5',
    vesselId: 'v-5',
    vesselName: 'Victoria Queen',
    effortType: 'Set Operations',
    effortValue: 450,
    effortUnit: 'sets',
    gearType: 'Beach seine',
    crewSize: 15,
    startDate: '2025-04-01',
    endDate: '2025-10-31',
    createdAt: '2025-11-15T10:00:00Z',
    updatedAt: '2026-01-10T09:00:00Z',
  },
];

interface EffortFormData {
  vesselId: string;
  vesselName: string;
  effortType: string;
  effortValue: number;
  effortUnit: string;
  gearType: string;
  crewSize: number;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: EffortFormData = {
  vesselId: '',
  vesselName: '',
  effortType: '',
  effortValue: 0,
  effortUnit: 'days',
  gearType: '',
  crewSize: 0,
  startDate: '',
  endDate: '',
};

export default function EffortsPage() {
  const t = useTranslations('fisheries');
  const tCommon = useTranslations('common');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [effortTypeFilter, setEffortTypeFilter] = useState('');
  const [gearTypeFilter, setGearTypeFilter] = useState('');
  const limit = 10;

  const [showDialog, setShowDialog] = useState(false);
  const [editingEffort, setEditingEffort] = useState<FishingEffort | null>(null);
  const [formData, setFormData] = useState<EffortFormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useFishingEfforts({
    page,
    limit,
    effortType: effortTypeFilter || undefined,
    gearType: gearTypeFilter || undefined,
    search: search || undefined,
  });

  const createMutation = useCreateEffort();
  const updateMutation = useUpdateEffort();
  const deleteMutation = useDeleteEffort();

  const efforts = data?.data?.length ? data.data : PLACEHOLDER_EFFORTS;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_EFFORTS.length,
    page: 1,
    limit: 10,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  const handleOpenCreate = () => {
    setEditingEffort(null);
    setFormData(EMPTY_FORM);
    setShowDialog(true);
  };

  const handleOpenEdit = (effort: FishingEffort) => {
    setEditingEffort(effort);
    setFormData({
      vesselId: effort.vesselId,
      vesselName: effort.vesselName,
      effortType: effort.effortType,
      effortValue: effort.effortValue,
      effortUnit: effort.effortUnit,
      gearType: effort.gearType,
      crewSize: effort.crewSize,
      startDate: effort.startDate,
      endDate: effort.endDate,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editingEffort) {
      await updateMutation.mutateAsync({ id: editingEffort.id, ...formData });
    } else {
      await createMutation.mutateAsync(formData as any);
    }
    setShowDialog(false);
    setEditingEffort(null);
    setFormData(EMPTY_FORM);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/fisheries"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('efforts')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('effortsDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('createEffort')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchEfforts')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={effortTypeFilter}
            onChange={(e) => {
              setEffortTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allEffortTypes')}</option>
            <option value="Days at Sea">Days at Sea</option>
            <option value="Hours Fished">Hours Fished</option>
            <option value="Trawl Hours">Trawl Hours</option>
            <option value="Set Operations">Set Operations</option>
          </select>
          <select
            value={gearTypeFilter}
            onChange={(e) => {
              setGearTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">{t('allGearTypes')}</option>
            <option value="Purse seine">Purse seine</option>
            <option value="Gillnet">Gillnet</option>
            <option value="Longline">Longline</option>
            <option value="Bottom trawl">Bottom trawl</option>
            <option value="Beach seine">Beach seine</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load efforts'}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('vessel')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('effortType')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('effortValue')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('effortUnit')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('startDate')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('endDate')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('gearType')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">{t('crewSize')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {efforts.map((eff) => (
                  <tr key={eff.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{eff.vesselName}</td>
                    <td className="px-4 py-3 text-gray-700">{eff.effortType}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {eff.effortValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{eff.effortUnit}</td>
                    <td className="px-4 py-3 text-gray-700">{eff.startDate}</td>
                    <td className="px-4 py-3 text-gray-700">{eff.endDate}</td>
                    <td className="px-4 py-3 text-gray-700">{eff.gearType}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{eff.crewSize}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(eff)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={t('editEffort')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(eff.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title={t('deleteEffort')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {efforts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      {t('noEffortsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {t('showingOf', { count: String(efforts.length), total: String(meta.total) })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-card border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingEffort ? t('editEffort') : t('createEffort')}
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('vessel')}</label>
                  <input
                    type="text"
                    value={formData.vesselName}
                    onChange={(e) => setFormData({ ...formData, vesselName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('effortType')}</label>
                  <select
                    value={formData.effortType}
                    onChange={(e) => setFormData({ ...formData, effortType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
                  >
                    <option value="">--</option>
                    <option value="Days at Sea">Days at Sea</option>
                    <option value="Hours Fished">Hours Fished</option>
                    <option value="Trawl Hours">Trawl Hours</option>
                    <option value="Set Operations">Set Operations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('effortValue')}</label>
                  <input
                    type="number"
                    value={formData.effortValue}
                    onChange={(e) => setFormData({ ...formData, effortValue: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('effortUnit')}</label>
                  <select
                    value={formData.effortUnit}
                    onChange={(e) => setFormData({ ...formData, effortUnit: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
                  >
                    <option value="days">days</option>
                    <option value="hours">hours</option>
                    <option value="sets">sets</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('crewSize')}</label>
                  <input
                    type="number"
                    value={formData.crewSize}
                    onChange={(e) => setFormData({ ...formData, crewSize: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500">{t('gearType')}</label>
                <select
                  value={formData.gearType}
                  onChange={(e) => setFormData({ ...formData, gearType: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none"
                >
                  <option value="">--</option>
                  <option value="Purse seine">Purse seine</option>
                  <option value="Gillnet">Gillnet</option>
                  <option value="Longline">Longline</option>
                  <option value="Bottom trawl">Bottom trawl</option>
                  <option value="Beach seine">Beach seine</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('startDate')}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">{t('endDate')}</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDialog(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? '...' : tCommon('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">{t('deleteEffort')}</h2>
            <p className="mt-2 text-sm text-gray-500">{t('confirmDeleteEffort')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? '...' : tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
