'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  useSettingsRoles,
  useSettingsRole,
  useSettingsPermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useUpdateRolePermissions,
  type RoleItem,
  type PermissionItem,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Pagination } from '@/components/ui/Pagination';
import {
  ShieldAlert,
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  Check,
  X,
  Globe,
  Building2,
  Flag,
  ChevronDown,
  ChevronRight,
  Shield,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { toast } from 'sonner';

/* ── Constants ── */

const LEVEL_DEFS = [
  { key: 'continental', labelKey: 'continental', icon: Globe, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
  { key: 'regional', labelKey: 'regional', icon: Building2, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
  { key: 'national', labelKey: 'national', icon: Flag, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30' },
] as const;

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'validate', 'configure'] as const;

const ACTION_KEY_MAP: Record<string, string> = {
  view: 'actionView',
  create: 'actionCreate',
  edit: 'actionEdit',
  delete: 'actionDelete',
  export: 'actionExport',
  validate: 'actionValidate',
  configure: 'actionConfigure',
};

const MODULE_KEY_MAP: Record<string, string> = {
  dashboard: 'moduleDashboard',
  'animal-health': 'moduleAnimalHealth',
  livestock: 'moduleLivestock',
  fisheries: 'moduleFisheries',
  trade: 'moduleTrade',
  wildlife: 'moduleWildlife',
  apiculture: 'moduleApiculture',
  governance: 'moduleGovernance',
  'climate-env': 'moduleClimateEnv',
  knowledge: 'moduleKnowledge',
  collecte: 'moduleCollecte',
  workflow: 'moduleWorkflow',
  'master-data': 'moduleMasterData',
  quality: 'moduleQuality',
  interop: 'moduleInterop',
  analytics: 'moduleAnalytics',
  historical: 'moduleHistorical',
  reports: 'moduleReports',
  'bi-tools': 'moduleBiTools',
  settings: 'moduleSettings',
};

/* ── Form type ── */

interface RoleFormData {
  code: string;
  level: string;
  color: string;
  icon: string;
  name: { en: string; fr: string; pt: string; ar: string };
  description: { en: string; fr: string; pt: string; ar: string };
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: RoleFormData = {
  code: '',
  level: 'national',
  color: '#6b7280',
  icon: 'Shield',
  name: { en: '', fr: '', pt: '', ar: '' },
  description: { en: '', fr: '', pt: '', ar: '' },
  isActive: true,
  sortOrder: 0,
};

const ROLE_COLORS = [
  '#dc2626', '#7c3aed', '#2563eb', '#16a34a', '#d97706',
  '#0891b2', '#6b7280', '#ea580c', '#db2777', '#059669',
];

/* ── Main component ── */

export default function RolesPage() {
  const t = useTranslations('settings');
  const { isSuperAdmin, isContinentalAdmin, isRecAdmin, canManageRoles, canCreateRole, canDeleteRole } = useSettingsAccess();
  const user = useAuthStore((s) => s.user);

  const LEVELS = LEVEL_DEFS.map((l) => ({ ...l, label: t(l.labelKey) }));

  // Only allow creating roles at or below the user's level
  const allowedLevels = useMemo(() => {
    if (isSuperAdmin || isContinentalAdmin) return LEVELS;
    if (isRecAdmin) return LEVELS.filter((l) => l.key !== 'continental');
    return LEVELS.filter((l) => l.key === 'national');
  }, [isSuperAdmin, isContinentalAdmin, isRecAdmin]);

  // Check if a role belongs to the current user's tenant (editable)
  const isOwnRole = useCallback((role: RoleItem) => {
    if (isSuperAdmin || isContinentalAdmin) return true;
    // System roles (tenantId=null) are read-only for non-continental
    if (!role.tenantId) return false;
    return role.tenantId === user?.tenantId;
  }, [isSuperAdmin, isContinentalAdmin, user?.tenantId]);

  // List state
  const [activeTab, setActiveTab] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormData>(EMPTY_FORM);

  // Permission matrix state
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [permissionsDirty, setPermissionsDirty] = useState(false);

  // API hooks
  const { data, isLoading } = useSettingsRoles({
    search, level: activeTab || undefined,
    status: statusFilter || undefined, page, limit,
  });
  const roles: RoleItem[] = data?.data ?? [];
  const meta = data?.meta ?? { total: roles.length, page: 1, limit };

  // Fetch total counts per level for the header badges
  const { data: contData } = useSettingsRoles({ level: 'continental', limit: 1 });
  const { data: regData } = useSettingsRoles({ level: 'regional', limit: 1 });
  const { data: natData } = useSettingsRoles({ level: 'national', limit: 1 });
  const countContinental = contData?.meta?.total ?? 0;
  const countRegional = regData?.meta?.total ?? 0;
  const countNational = natData?.meta?.total ?? 0;

  const { data: roleDetail, isLoading: detailLoading } = useSettingsRole(editingId ?? '');
  const { data: allPermsData } = useSettingsPermissions();
  const allPermissions: PermissionItem[] = allPermsData?.data ?? [];

  const createMut = useCreateRole();
  const updateMut = useUpdateRole();
  const deleteMut = useDeleteRole();
  const permMut = useUpdateRolePermissions();

  /* ── Permission matrix helpers ── */

  // Group permissions by module → feature → actions
  const permissionTree = useMemo(() => {
    const tree: Record<string, Record<string, Record<string, PermissionItem>>> = {};
    for (const p of allPermissions) {
      if (!tree[p.module]) tree[p.module] = {};
      if (!tree[p.module][p.feature]) tree[p.module][p.feature] = {};
      tree[p.module][p.feature][p.action] = p;
    }
    return tree;
  }, [allPermissions]);

  const moduleList = useMemo(() => Object.keys(permissionTree).sort(), [permissionTree]);

  // When role detail loads, sync permission selection
  React.useEffect(() => {
    if (roleDetail?.data?.permissions && editingId) {
      const ids = new Set(roleDetail.data.permissions.map((rp: any) => rp.permissionId ?? rp.permission?.id));
      setSelectedPermissionIds(ids);
      setPermissionsDirty(false);
    }
  }, [roleDetail, editingId]);

  const togglePermission = useCallback((permId: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setPermissionsDirty(true);
  }, []);

  const toggleModule = useCallback((module: string) => {
    const features = permissionTree[module];
    if (!features) return;
    const modulePermIds: string[] = [];
    for (const feat of Object.values(features)) {
      for (const p of Object.values(feat)) modulePermIds.push(p.id);
    }
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      const allSelected = modulePermIds.every((id) => next.has(id));
      if (allSelected) {
        modulePermIds.forEach((id) => next.delete(id));
      } else {
        modulePermIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setPermissionsDirty(true);
  }, [permissionTree]);

  const toggleAction = useCallback((action: string) => {
    const actionPermIds: string[] = [];
    for (const features of Object.values(permissionTree)) {
      for (const perms of Object.values(features)) {
        if (perms[action]) actionPermIds.push(perms[action].id);
      }
    }
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      const allSelected = actionPermIds.every((id) => next.has(id));
      if (allSelected) {
        actionPermIds.forEach((id) => next.delete(id));
      } else {
        actionPermIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setPermissionsDirty(true);
  }, [permissionTree]);

  const toggleModuleExpand = useCallback((module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpandedModules(new Set(moduleList)), [moduleList]);
  const collapseAll = useCallback(() => setExpandedModules(new Set()), []);

  /* ── Helpers ── */

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

  /* ── Actions ── */

  const openCreate = useCallback(() => {
    const defaultLevel = (activeTab && allowedLevels.some((l) => l.key === activeTab))
      ? activeTab
      : allowedLevels[0]?.key ?? 'national';
    setForm({ ...EMPTY_FORM, level: defaultLevel });
    setEditingId(null);
    setSelectedPermissionIds(new Set());
    setPermissionsDirty(false);
    setExpandedModules(new Set());
    setView('form');
  }, [activeTab, allowedLevels]);

  const openEdit = useCallback((role: RoleItem) => {
    setForm({
      code: role.code,
      level: role.level,
      color: role.color,
      icon: role.icon,
      name: { en: role.name?.en ?? '', fr: role.name?.fr ?? '', pt: role.name?.pt ?? '', ar: role.name?.ar ?? '' },
      description: {
        en: role.description?.en ?? '', fr: role.description?.fr ?? '',
        pt: role.description?.pt ?? '', ar: role.description?.ar ?? '',
      },
      isActive: role.isActive,
      sortOrder: role.sortOrder,
    });
    setEditingId(role.id);
    setPermissionsDirty(false);
    setView('form');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setEditingId(null);
    setPermissionsDirty(false);
  }, []);

  const handleSave = useCallback(async () => {
    const cleanName: Record<string, string> = {};
    for (const [k, v] of Object.entries(form.name)) {
      if (v.trim()) cleanName[k] = v.trim();
    }
    if (!cleanName.en) {
      toast.error(t('validationError'), { description: t('nameEnRequired') });
      return;
    }

    const descEntries = Object.entries(form.description).filter(([, v]) => v.trim());
    const cleanDesc = descEntries.length > 0
      ? Object.fromEntries(descEntries.map(([k, v]) => [k, v.trim()]))
      : null;

    try {
      if (editingId) {
        await updateMut.mutateAsync({
          id: editingId,
          name: cleanName,
          description: cleanDesc,
          color: form.color,
          icon: form.icon,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
        toast.success(t('roleUpdated'), {
          description: t('roleUpdatedDesc', { name: cleanName.en }),
        });
      } else {
        if (!form.code) {
          toast.error(t('validationError'), { description: t('codeRequired') });
          return;
        }
        const result: any = await createMut.mutateAsync({
          code: form.code,
          name: cleanName,
          description: cleanDesc,
          level: form.level,
          color: form.color,
          icon: form.icon,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
        const newId = result?.data?.id;
        toast.success(t('roleCreated'), {
          description: t('roleCreatedDesc', { name: cleanName.en }),
        });
        // If permissions were set during creation, save them
        if (newId && selectedPermissionIds.size > 0) {
          await permMut.mutateAsync({ roleId: newId, permissionIds: Array.from(selectedPermissionIds) });
        }
      }

      // Save permissions if editing and dirty
      if (editingId && permissionsDirty) {
        await permMut.mutateAsync({ roleId: editingId, permissionIds: Array.from(selectedPermissionIds) });
      }

      setView('list');
      setEditingId(null);
      setPermissionsDirty(false);
    } catch (err: any) {
      toast.error(editingId ? t('failedUpdateRole') : t('failedCreateRole'), {
        description: err?.message ?? t('unexpectedError'),
      });
    }
  }, [form, editingId, selectedPermissionIds, permissionsDirty, createMut, updateMut, permMut]);

  const handleDelete = useCallback(async (id: string, code: string) => {
    if (!confirm(t('deleteRoleConfirm', { code }))) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t('roleDeleted'), { description: t('roleDeletedDesc', { code }) });
    } catch (err: any) {
      toast.error(t('failedDeleteRole'), {
        description: err?.message ?? t('pleaseTryAgain'),
      });
    }
  }, [deleteMut]);

  /* ── Permission matrix ── */

  function isModuleFullySelected(module: string): boolean {
    const features = permissionTree[module];
    if (!features) return false;
    for (const perms of Object.values(features)) {
      for (const p of Object.values(perms)) {
        if (!selectedPermissionIds.has(p.id)) return false;
      }
    }
    return true;
  }

  function isModulePartiallySelected(module: string): boolean {
    const features = permissionTree[module];
    if (!features) return false;
    let hasAny = false;
    let hasAll = true;
    for (const perms of Object.values(features)) {
      for (const p of Object.values(perms)) {
        if (selectedPermissionIds.has(p.id)) hasAny = true;
        else hasAll = false;
      }
    }
    return hasAny && !hasAll;
  }

  function renderPermissionMatrix() {
    if (!allPermissions.length) {
      return (
        <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
          {t('noPermissionsFound')}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-aris-primary-600 hover:text-aris-primary-700 dark:text-aris-primary-400"
            >
              {t('expandAll')}
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-aris-primary-600 hover:text-aris-primary-700 dark:text-aris-primary-400"
            >
              {t('collapseAll')}
            </button>
          </div>
          <span className="rounded-full bg-aris-primary-50 px-2.5 py-0.5 text-xs font-semibold text-aris-primary-700 dark:bg-aris-primary-900/30 dark:text-aris-primary-400">
            {selectedPermissionIds.size} / {allPermissions.length} {t('permissionsLabel')}
          </span>
        </div>

        {/* Matrix table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-left font-medium text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 min-w-[240px]">
                  {t('moduleFeature')}
                </th>
                {ACTIONS.map((action) => (
                  <th key={action} className="px-2 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">
                    <button
                      onClick={() => toggleAction(action)}
                      className="hover:text-aris-primary-600 dark:hover:text-aris-primary-400"
                    >
                      {t(ACTION_KEY_MAP[action] ?? action)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {moduleList.map((module) => {
                const features = permissionTree[module];
                const featureKeys = Object.keys(features).sort();
                const isExpanded = expandedModules.has(module);
                const fullSel = isModuleFullySelected(module);
                const partSel = isModulePartiallySelected(module);

                return (
                  <React.Fragment key={module}>
                    {/* Module row */}
                    <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                      <td className="sticky left-0 z-10 bg-gray-50/50 px-4 py-2 dark:bg-gray-800/30">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleModuleExpand(module)}
                            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />
                            }
                          </button>
                          <input
                            type="checkbox"
                            checked={fullSel}
                            ref={(el) => { if (el) el.indeterminate = partSel; }}
                            onChange={() => toggleModule(module)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-aris-primary-600"
                          />
                          <button
                            onClick={() => toggleModuleExpand(module)}
                            className="font-semibold text-gray-900 dark:text-white"
                          >
                            {MODULE_KEY_MAP[module] ? t(MODULE_KEY_MAP[module]) : module}
                          </button>
                          <span className="text-[10px] text-gray-400">({featureKeys.length})</span>
                        </div>
                      </td>
                      {/* Module-level action checkboxes — count of selected per action */}
                      {ACTIONS.map((action) => {
                        let total = 0;
                        let selected = 0;
                        for (const perms of Object.values(features)) {
                          if (perms[action]) {
                            total++;
                            if (selectedPermissionIds.has(perms[action].id)) selected++;
                          }
                        }
                        if (total === 0) return <td key={action} className="px-2 py-2 text-center"><span className="text-gray-300 dark:text-gray-600">-</span></td>;
                        return (
                          <td key={action} className="px-2 py-2 text-center">
                            <span className={cn(
                              'text-[10px] font-medium',
                              selected === total ? 'text-aris-primary-600 dark:text-aris-primary-400' : 'text-gray-400',
                            )}>
                              {selected}/{total}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Feature rows (expanded) */}
                    {isExpanded && featureKeys.map((feature) => {
                      const perms = features[feature];
                      return (
                        <tr key={`${module}-${feature}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-12 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                            {feature}
                          </td>
                          {ACTIONS.map((action) => {
                            const perm = perms[action];
                            if (!perm) return <td key={action} className="px-2 py-1.5 text-center"><span className="text-gray-200 dark:text-gray-700">-</span></td>;
                            return (
                              <td key={action} className="px-2 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissionIds.has(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-aris-primary-600"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ── Form view ── */

  if (view === 'form') {
    const isSystemRole = editingId && roleDetail?.data?.isSystem;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-aris-primary-600" />
              {editingId ? t('editRole') : t('newRole')}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editingId
                ? `${t('editingRole', { name: form.name.en || form.code })}${isSystemRole ? ` ${t('systemRoleLimited')}` : ''}`
                : t('defineNewRole')}
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

        {/* Role details form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('roleDetails')}</h2>
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
                placeholder="CUSTOM_ROLE"
              />
            </div>

            {/* Level */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('level')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                disabled={!!editingId || !!isSystemRole}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-50"
              >
                {allowedLevels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>

            {/* Color */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('color')}
              </label>
              <div className="flex items-center gap-2">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform',
                      form.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
                    placeholder={lang === 'en' ? t('nameRequired') : t('nameInLang', { lang: lang.toUpperCase() })}
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
              placeholder={t('briefDescription')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {/* Flags */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                disabled={!!isSystemRole}
                className="h-4 w-4 rounded border-gray-300 text-aris-primary-600"
              />
              {t('active')}
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">{t('sortOrder')}</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Permission matrix */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-4 w-4 text-aris-primary-600" />
            {t('permissionMatrix')}
          </h2>
          {detailLoading && editingId ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            renderPermissionMatrix()
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleBack}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.en || (!editingId && !form.code) || createMut.isPending || updateMut.isPending || permMut.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {(createMut.isPending || updateMut.isPending || permMut.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {editingId ? t('updateRole') : t('createRole')}
          </button>
        </div>
      </div>
    );
  }

  /* ── List view ── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-aris-primary-600" />
            {t('rolesPermissions')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('manageRolesSubtitle')}
          </p>
        </div>
        {canCreateRole && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700"
          >
            <Plus className="h-4 w-4" />
            {t('newRole')}
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
          {t('all')} ({meta.total})
        </button>
        {LEVELS.map((lvl) => {
          const count = lvl.key === 'continental' ? countContinental
            : lvl.key === 'regional' ? countRegional
            : countNational;
          return (
            <button
              key={lvl.key}
              onClick={() => { setActiveTab(lvl.key); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === lvl.key
                  ? cn('bg-white shadow-sm dark:bg-gray-700', lvl.color)
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              <lvl.icon className="h-3.5 w-3.5" />
              {lvl.label}
              <span className="ml-1 text-[10px] opacity-70">({count})</span>
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
            placeholder={t('searchRoles')}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">{t('allStatuses')}</option>
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
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('role')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('code')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('level')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('type')}</th>
                {(isSuperAdmin || isContinentalAdmin) && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('tenant')}</th>
                )}
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('users')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('status')}</th>
                {canManageRoles && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {roles.map((role) => (
                <tr key={role.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold"
                        style={{ backgroundColor: role.color }}
                      >
                        {(role.name?.en ?? role.code).charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {role.name?.en ?? role.code}
                        </div>
                        {role.name?.fr && (
                          <div className="text-[11px] text-gray-400">{role.name.fr}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-gray-800">
                      {role.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getLevelBadge(role.level)}</td>
                  <td className="px-4 py-3">
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        <Shield className="h-3 w-3" />
                        {t('systemRole')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {t('customRole')}
                      </span>
                    )}
                  </td>
                  {(isSuperAdmin || isContinentalAdmin) && (
                    <td className="px-4 py-3">
                      {role.tenant ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {role.tenant.countryCode ? role.tenant.countryCode.toUpperCase() : role.tenant.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          {t('globalRole')}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {role._count?.userRoles ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      role.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                    )}>
                      {role.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  {canManageRoles && (
                    <td className="px-4 py-3">
                      {isOwnRole(role) ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(role)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title={t('editRolePermissions')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {canDeleteRole && !role.isSystem && (
                            <button
                              onClick={() => handleDelete(role.id, role.code)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title={t('deleteRoleBtn')}
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">--</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('noRolesFound')} {canCreateRole && t('clickNewRole')}
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
            onLimitChange={(v) => { setLimit(v); setPage(1); }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}
    </div>
  );
}
