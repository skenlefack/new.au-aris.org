'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  useSettingsFunctions,
  useCreateFunction,
  useUpdateFunction,
  useDeleteFunction,
  type FunctionItem,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Pagination } from '@/components/ui/Pagination';
import {
  Briefcase,
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Loader2,
  X,
  Check,
  Globe,
  Building2,
  Flag,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

const LEVEL_DEFS = [
  { key: 'continental', labelKey: 'continental', icon: Globe, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
  { key: 'regional', labelKey: 'regional', icon: Building2, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
  { key: 'national', labelKey: 'national', icon: Flag, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30' },
] as const;

const CATEGORY_DEFS = [
  { key: 'management', labelKey: 'categoryManagement', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { key: 'technical', labelKey: 'categoryTechnical', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'data', labelKey: 'categoryData', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { key: 'admin', labelKey: 'categoryAdmin', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { key: 'field', labelKey: 'categoryField', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

interface FunctionFormData {
  code: string;
  level: 'continental' | 'regional' | 'national';
  category: string;
  name: { en: string; fr: string; pt: string; ar: string };
  description: { en: string; fr: string; pt: string; ar: string };
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const EMPTY_FORM: FunctionFormData = {
  code: '',
  level: 'continental',
  category: 'management',
  name: { en: '', fr: '', pt: '', ar: '' },
  description: { en: '', fr: '', pt: '', ar: '' },
  isActive: true,
  isDefault: false,
  sortOrder: 0,
};

export default function FunctionsPage() {
  const t = useTranslations('settings');
  const [activeTab, setActiveTab] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const { isSuperAdmin, isContinentalAdmin, isRecAdmin, canManageFunctions, canDeleteFunction, tenantLevel } = useSettingsAccess();

  const LEVELS = LEVEL_DEFS.map((l) => ({ ...l, label: t(l.labelKey) }));
  const CATEGORIES = CATEGORY_DEFS.map((c) => ({ ...c, label: t(c.labelKey) }));

  function getCategoryBadge(cat: string | null | undefined) {
    const found = CATEGORIES.find((c) => c.key === cat);
    if (!found) return null;
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', found.color)}>
        {found.label}
      </span>
    );
  }

  function getLevelBadge(level: string) {
    const found = LEVELS.find((l) => l.key === level);
    if (!found) return <span className="text-xs text-gray-400">{level}</span>;
    const Icon = found.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', found.color)}>
        <Icon className="h-3 w-3" />
        {found.label}
      </span>
    );
  }
  const user = useAuthStore((s) => s.user);
  const canManage = canManageFunctions;

  // Only allow creating functions at or below the user's level
  const allowedLevels = useMemo(() => {
    if (isSuperAdmin || isContinentalAdmin) return LEVELS;
    if (isRecAdmin) return LEVELS.filter((l) => l.key !== 'continental');
    return LEVELS.filter((l) => l.key === 'national');
  }, [isSuperAdmin, isContinentalAdmin, isRecAdmin]);

  // Check if a function belongs to the current user's tenant (editable)
  const isOwnFunction = useCallback((fn: FunctionItem) => {
    if (isSuperAdmin || isContinentalAdmin) return true;
    return fn.tenantId === user?.tenantId;
  }, [isSuperAdmin, isContinentalAdmin, user?.tenantId]);

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');

  const { data, isLoading } = useSettingsFunctions({
    search,
    level: activeTab || undefined,
    status: statusFilter || undefined,
    page,
    limit,
  });

  const functions: FunctionItem[] = data?.data ?? [];
  const meta = data?.meta ?? { total: functions.length, page: 1, limit };

  const createMut = useCreateFunction();
  const updateMut = useUpdateFunction();
  const deleteMut = useDeleteFunction();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FunctionFormData>(EMPTY_FORM);

  const openCreate = useCallback(() => {
    const defaultLevel = (activeTab && allowedLevels.some((l) => l.key === activeTab))
      ? activeTab as FunctionFormData['level']
      : allowedLevels[0]?.key as FunctionFormData['level'] ?? 'national';
    setForm({ ...EMPTY_FORM, level: defaultLevel });
    setEditingId(null);
    setView('form');
  }, [activeTab, allowedLevels]);

  const openEdit = useCallback((fn: FunctionItem) => {
    setForm({
      code: fn.code,
      level: fn.level,
      category: fn.category ?? 'management',
      name: { en: fn.name?.en ?? '', fr: fn.name?.fr ?? '', pt: fn.name?.pt ?? '', ar: fn.name?.ar ?? '' },
      description: {
        en: fn.description?.en ?? '', fr: fn.description?.fr ?? '',
        pt: fn.description?.pt ?? '', ar: fn.description?.ar ?? '',
      },
      isActive: fn.isActive,
      isDefault: fn.isDefault,
      sortOrder: fn.sortOrder,
    });
    setEditingId(fn.id);
    setView('form');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setEditingId(null);
  }, []);

  const handleSave = useCallback(async () => {
    const payload = {
      code: form.code,
      name: form.name,
      description: form.description,
      level: form.level,
      category: form.category || null,
      isActive: form.isActive,
      isDefault: form.isDefault,
      sortOrder: form.sortOrder,
    };

    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    setView('list');
    setEditingId(null);
  }, [form, editingId, createMut, updateMut]);

  const handleDelete = useCallback(async (id: string, code: string) => {
    if (!confirm(t('deleteFunctionConfirm', { code }))) return;
    await deleteMut.mutateAsync(id);
  }, [deleteMut]);

  // Group by level for the tab view
  const grouped = LEVELS.map((l) => ({
    ...l,
    items: functions.filter((f) => f.level === l.key),
    count: functions.filter((f) => f.level === l.key).length,
  }));

  if (view === 'form') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-aris-primary-600" />
              {editingId ? t('editFunction') : t('newFunction')}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editingId ? t('editingFunction', { name: form.name.en || form.code }) : t('defineNewFunction')}
            </p>
          </div>
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </button>
        </div>

        {/* Inline form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Code */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('code')} <span className="text-red-500">*</span>
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
                disabled={!!editingId}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-50"
                placeholder="DIR_GEN"
              />
            </div>

            {/* Level */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('level')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as FunctionFormData['level'] }))}
                disabled={!!editingId}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-50"
              >
                {allowedLevels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('category')}
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Names (4 languages) */}
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('name')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(['en', 'fr', 'pt', 'ar'] as const).map((lang) => (
                <div key={lang} className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-gray-400">
                    {lang}
                  </span>
                  <input
                    value={form.name[lang]}
                    onChange={(e) => setForm((f) => ({ ...f, name: { ...f.name, [lang]: e.target.value } }))}
                    placeholder={lang === 'en' ? 'Name (required)' : `Name (${lang})`}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('descriptionEn')}
            </label>
            <input
              value={form.description.en}
              onChange={(e) => setForm((f) => ({ ...f, description: { ...f.description, en: e.target.value } }))}
              placeholder="Brief description..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {/* Flags row */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-aris-primary-600"
              />
              {t('active')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-aris-primary-600"
              />
              {t('default')}
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">{t('sort')}</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                min={0}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              onClick={handleBack}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.code || !form.name.en || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {(createMut.isPending || updateMut.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {editingId ? t('update') : t('create')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-aris-primary-600" />
            {t('functionsTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('functionsSubtitle')}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            {t('addFunction')}
          </button>
        )}
      </div>

      {/* Level Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50">
        <button
          onClick={() => { setActiveTab(''); setPage(1); }}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            !activeTab
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          All ({meta.total})
        </button>
        {LEVELS.map((lvl) => {
          const g = grouped.find((g) => g.key === lvl.key);
          return (
            <button
              key={lvl.key}
              onClick={() => { setActiveTab(lvl.key); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === lvl.key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              <lvl.icon className="h-3.5 w-3.5" />
              {lvl.label}
              <span className="ml-1 text-[10px] text-gray-400">({g?.count ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('searchFunctions')}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">{t('allStatusFilter')}</option>
          <option value="active">{t('active')}</option>
          <option value="inactive">{t('inactive')}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('code')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('nameEn')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('nameFr')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('level')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('category')}</th>
                {(isSuperAdmin || isContinentalAdmin) && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('tenant')}</th>
                )}
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('users')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('status')}</th>
                {canManage && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {functions.map((fn) => (
                <tr key={fn.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-gray-800">
                      {fn.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {fn.name?.en ?? fn.code}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {fn.name?.fr ?? '-'}
                  </td>
                  <td className="px-4 py-3">{getLevelBadge(fn.level)}</td>
                  <td className="px-4 py-3">{getCategoryBadge(fn.category)}</td>
                  {(isSuperAdmin || isContinentalAdmin) && (
                    <td className="px-4 py-3">
                      {fn.tenant ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {fn.tenant.countryCode ? fn.tenant.countryCode.toUpperCase() : fn.tenant.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {fn._count?.users ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      fn.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                    )}>
                      {fn.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {isOwnFunction(fn) ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(fn)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {canDeleteFunction && (
                            <button
                              onClick={() => handleDelete(fn.id, fn.code)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Delete"
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {functions.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('noFunctionsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={meta.page}
            total={meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={() => {}}
          />
        </div>
      )}
    </div>
  );
}
