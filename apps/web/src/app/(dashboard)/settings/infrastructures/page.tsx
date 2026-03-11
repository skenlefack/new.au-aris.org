'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2, Plus, Search, X, ChevronDown, Pencil, Trash2, ArrowLeft,
  Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import {
  useRefDataList,
  useCreateRefData,
  useUpdateRefData,
  useDeleteRefData,
  type RefDataItem,
} from '@/lib/api/ref-data-hooks';

const CATEGORY_OPTIONS = [
  { value: 'laboratory', en: 'Laboratory', fr: 'Laboratoire' },
  { value: 'slaughterhouse', en: 'Slaughterhouse', fr: 'Abattoir' },
  { value: 'market', en: 'Market', fr: 'Marché' },
  { value: 'storage', en: 'Storage', fr: 'Entreposage' },
  { value: 'checkpoint', en: 'Checkpoint / Control Post', fr: 'Poste de contrôle' },
  { value: 'port_airport', en: 'Port / Airport', fr: 'Port / Aéroport' },
  { value: 'training_center', en: 'Training / Education Center', fr: 'Centre de formation' },
  { value: 'breeding_station', en: 'Breeding / Livestock Station', fr: "Station d'élevage" },
  { value: 'collection_center', en: 'Collection / Packaging Center', fr: 'Centre de collecte' },
  { value: 'protected_area', en: 'Park / Reserve', fr: 'Parc / Réserve' },
  { value: 'industry', en: 'Processing Industry', fr: 'Industrie de transformation' },
  { value: 'water_infrastructure', en: 'Water Infrastructure', fr: 'Infrastructure hydraulique' },
  { value: 'veterinary_center', en: 'Veterinary Center', fr: 'Centre vétérinaire' },
  { value: 'admin_office', en: 'Administrative Office', fr: 'Bureau administratif' },
  { value: 'other', en: 'Other', fr: 'Autre' },
];

function getCategoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.en ?? value;
}

const ITEMS_PER_PAGE = 50;

export default function InfrastructureTypesConfigPage() {
  const { isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const canEdit = isSuperAdmin || isContinentalAdmin;

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);

  // Data fetching
  const { data: listData, isLoading } = useRefDataList('infrastructures', {
    page,
    limit: ITEMS_PER_PAGE,
    search: search || undefined,
    category: filterCategory || undefined,
    scope: 'continental',
    isActive: 'all',
  });

  const items = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Mutations
  const createMutation = useCreateRefData('infrastructures');
  const updateMutation = useUpdateRefData('infrastructures');
  const deleteMutation = useDeleteRefData('infrastructures');

  // Form state
  const [editingItem, setEditingItem] = useState<RefDataItem | null>(null);
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [category, setCategory] = useState('');
  const [subType, setSubType] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const resetForm = (item?: RefDataItem | null) => {
    setCode(item?.code ?? '');
    setNameEn(item?.name?.en ?? '');
    setNameFr(item?.name?.fr ?? '');
    setCategory(item?.category ?? '');
    setSubType(item?.subType ?? '');
    setSortOrder(item?.sortOrder?.toString() ?? '0');
    setIsActive(item?.isActive ?? true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    resetForm();
    setView('form');
  };

  const handleEdit = (item: RefDataItem) => {
    setEditingItem(item);
    resetForm(item);
    setView('form');
  };

  const handleBack = () => {
    setView('list');
    setEditingItem(null);
  };

  const handleDelete = async (item: RefDataItem) => {
    if (!confirm(`Delete type definition "${item.name?.en ?? item.code}"? This will remove it from the type catalogue.`)) return;
    await deleteMutation.mutateAsync(item.id);
  };

  const handleToggleActive = async (item: RefDataItem) => {
    await updateMutation.mutateAsync({
      id: item.id,
      body: { isActive: !item.isActive },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !nameEn || !category || !subType) return;

    const formData = {
      code,
      name: { en: nameEn, fr: nameFr || nameEn },
      category,
      subType,
      sortOrder: parseInt(sortOrder, 10) || 0,
      isActive,
      scope: 'continental',
      ownerType: 'continental',
      status: 'operational',
    };

    if (editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, body: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setView('list');
    setEditingItem(null);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const groupedItems = useMemo(() => {
    const groups: Record<string, RefDataItem[]> = {};
    for (const item of items) {
      const cat = item.category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [items]);

  const categoryCount = Object.keys(groupedItems).length;

  if (view === 'form') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-6 w-6 text-aris-primary-600" />
              {editingItem ? 'Edit Infrastructure Type' : 'New Infrastructure Type'}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editingItem ? `Editing: ${editingItem.name?.en ?? editingItem.code}` : 'Define a new infrastructure category and sub-type'}
            </p>
          </div>
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Inline form */}
        <form onSubmit={handleFormSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
                required
              >
                <option value="">Select category...</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.en} / {c.fr}</option>
                ))}
              </select>
            </div>

            {/* Sub-Type Key */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sub-Type Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
                placeholder="e.g. veterinary, industrial"
                required
              />
            </div>

            {/* Code */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
                placeholder="e.g. INFRA-LAB-VET"
                required
                maxLength={50}
              />
            </div>

            {/* Name EN */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name (EN) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
                placeholder="Name in English"
                required
              />
            </div>

            {/* Name FR */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name (FR)
              </label>
              <input
                type="text"
                value={nameFr}
                onChange={(e) => setNameFr(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
                placeholder="Nom en français"
              />
            </div>

            {/* Sort Order */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
                min={0}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="mt-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-aris-primary-600 focus:ring-aris-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {isActive ? 'Active — visible to all users' : 'Inactive — hidden from users'}
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !code || !nameEn || !category || !subType}
              className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingItem ? 'Save Changes' : 'Create Type'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-aris-primary-600" />
            Infrastructure Type Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure infrastructure categories and sub-types available across the platform
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Type
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{total}</span>
          <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">Types</span>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{categoryCount}</span>
          <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">Categories</span>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5">
          <span className="text-2xl font-bold text-emerald-600">{items.filter(i => i.isActive).length}</span>
          <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">Active</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search types..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
            className="appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-8 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-aris-primary-500"
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.en}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name (EN)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name (FR)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sub-Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Order</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active</th>
              {canEdit && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                  No infrastructure types found. Click &quot;Add Type&quot; to create one.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className={cn(
                  'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors',
                  !item.isActive && 'opacity-50',
                )}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{item.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name?.en ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.name?.fr ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {getCategoryLabel(item.category ?? '')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.subType ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{item.sortOrder ?? 0}</td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="group"
                        title={item.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {item.isActive ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 group-hover:text-emerald-700" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 group-hover:text-gray-500 dark:text-gray-600" />
                        )}
                      </button>
                    ) : (
                      item.isActive ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                      )
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
