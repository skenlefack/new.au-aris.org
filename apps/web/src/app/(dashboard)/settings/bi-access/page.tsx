'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3, PieChart, BarChart2, ShieldCheck, Eye, EyeOff, Save, ChevronDown, ChevronUp, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useBiTools, useBiAccessRules, useUpsertBiAccessRule, type BiToolConfig, type BiAccessRule } from '@/lib/api/bi-hooks';
import { useSettingsRoles, type RoleItem } from '@/lib/api/settings-hooks';

/* ── Constants ── */

const ICON_MAP: Record<string, React.ElementType> = {
  superset: BarChart3,
  metabase: PieChart,
  grafana: BarChart2,
};

const COLOR_MAP: Record<string, string> = {
  superset: '#1FC2A7',
  metabase: '#509EE3',
  grafana: '#FF6600',
};

const SCHEMAS = ['public', 'historical'];

const SENSITIVE_TABLES = ['User', 'Session', 'RefreshToken', 'AuditLog', 'ApiKey', '_prisma_migrations'];

const PUBLIC_TABLES = [
  'Country', 'Tenant', 'Disease', 'Species', 'GeoEntity', 'AdminLevel',
  'CollecteCampaign', 'CollecteSubmission', 'FormTemplate',
  'WorkflowDefinition', 'WorkflowInstance', 'WorkflowStep',
  'HealthEvent', 'LabResult', 'Vaccination', 'Surveillance',
  'LivestockCensus', 'ProductionRecord', 'SlaughterRecord', 'TranshumanceCorridor',
  'FisheryCapture', 'Vessel', 'AquacultureFarm',
  'TradeFlow', 'SpsCertificate', 'MarketPrice',
  'WildlifeInventory', 'ProtectedArea', 'CitesPermit',
  'Apiary', 'HoneyProduction', 'ColonyHealth',
  'ClimateData', 'WaterStress', 'Rangeland',
  'Notification', 'File',
];

const LEVEL_COLORS: Record<string, string> = {
  CONTINENTAL: '#DC2626',
  REGIONAL: '#7C3AED',
  NATIONAL: '#2563EB',
};

/* ── Helpers ── */

function getTableCategory(table: string): string {
  if (table.includes('Health') || table.includes('Lab') || table.includes('Vaccination') || table.includes('Surveillance')) return 'Animal Health';
  if (table.includes('Livestock') || table.includes('Production') || table.includes('Slaughter') || table.includes('Transhumance')) return 'Livestock';
  if (table.includes('Fish') || table.includes('Vessel') || table.includes('Aquaculture')) return 'Fisheries';
  if (table.includes('Trade') || table.includes('Sps') || table.includes('Market')) return 'Trade & SPS';
  if (table.includes('Wildlife') || table.includes('Protected') || table.includes('Cites')) return 'Wildlife';
  if (table.includes('Apiary') || table.includes('Honey') || table.includes('Colony')) return 'Apiculture';
  if (table.includes('Climate') || table.includes('Water') || table.includes('Rangeland')) return 'Climate & Env';
  if (table.includes('Collecte') || table.includes('Form')) return 'Collecte';
  if (table.includes('Workflow')) return 'Workflow';
  if (table.includes('Notification') || table.includes('File')) return 'System';
  return 'Master Data';
}

/* ── Page ── */

export default function BiAccessPage() {
  const t = useTranslations('settings');
  const { user } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);

  const [selectedTool, setSelectedTool] = useState('superset');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // Local edits keyed by role code
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<BiAccessRule>>>({});

  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'CONTINENTAL_ADMIN';

  // Fetch BI tools from API
  const { data: toolsData, isLoading: toolsLoading } = useBiTools();
  const tools = toolsData?.data ?? [];

  // Fetch roles from DB
  const { data: rolesData, isLoading: rolesLoading } = useSettingsRoles({ limit: 100 });
  const roles: RoleItem[] = rolesData?.data ?? [];

  // Fetch access rules for selected tool
  const { data: rulesData, isLoading: rulesLoading } = useBiAccessRules(selectedTool);
  const accessRules: BiAccessRule[] = rulesData?.data ?? [];

  // Upsert mutation
  const upsertRule = useUpsertBiAccessRule();

  // Find the tool config for selected tool
  const activeTool = tools.find((t) => t.tool === selectedTool);
  const activeToolId = activeTool?.id ?? selectedTool;

  // Build merged configs: role + its matching access rule + local edits
  const mergedConfigs = useMemo(() => {
    return roles.map((role) => {
      const rule = accessRules.find((r) => r.roleLevel === role.code && (r.tool === selectedTool || !r.tool));
      const edits = localEdits[role.code] ?? {};
      return {
        role,
        rule,
        allowedSchemas: edits.allowedSchemas ?? rule?.allowedSchemas ?? [],
        allowedTables: edits.allowedTables ?? rule?.allowedTables ?? [],
        excludedTables: edits.excludedTables ?? rule?.excludedTables ?? SENSITIVE_TABLES,
        canCreateDashboard: edits.canCreateDashboard ?? rule?.canCreateDashboard ?? false,
        canExportData: edits.canExportData ?? rule?.canExportData ?? false,
        canUseSqlLab: edits.canUseSqlLab ?? rule?.canUseSqlLab ?? false,
      };
    });
  }, [roles, accessRules, localEdits, selectedTool]);

  const updateLocalEdit = useCallback((roleCode: string, patch: Partial<BiAccessRule>) => {
    setLocalEdits((prev) => ({
      ...prev,
      [roleCode]: { ...prev[roleCode], ...patch },
    }));
    setSaveStatus('idle');
  }, []);

  const toggleSchema = (roleCode: string, schema: string, currentSchemas: string[]) => {
    const schemas = currentSchemas.includes(schema)
      ? currentSchemas.filter((s) => s !== schema)
      : [...currentSchemas, schema];
    updateLocalEdit(roleCode, { allowedSchemas: schemas });
  };

  const toggleTable = (roleCode: string, table: string, currentTables: string[]) => {
    const tables = currentTables.includes(table)
      ? currentTables.filter((t) => t !== table)
      : [...currentTables, table];
    updateLocalEdit(roleCode, { allowedTables: tables });
  };

  const togglePermission = (roleCode: string, perm: 'canCreateDashboard' | 'canExportData' | 'canUseSqlLab', currentValue: boolean) => {
    updateLocalEdit(roleCode, { [perm]: !currentValue });
  };

  const handleSave = async () => {
    if (!isSuperAdmin || saving) return;
    setSaving(true);
    setSaveStatus('idle');

    try {
      // Save all roles that have local edits
      const rolesToSave = Object.keys(localEdits).length > 0
        ? mergedConfigs.filter((c) => localEdits[c.role.code])
        : mergedConfigs;

      for (const config of rolesToSave) {
        await upsertRule.mutateAsync({
          biToolConfigId: activeToolId,
          roleLevel: config.role.code,
          allowedSchemas: config.allowedSchemas,
          allowedTables: config.allowedTables,
          excludedTables: config.excludedTables,
          canCreateDashboard: config.canCreateDashboard,
          canExportData: config.canExportData,
          canUseSqlLab: config.canUseSqlLab,
        });
      }

      setLocalEdits({});
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = toolsLoading || rolesLoading || rulesLoading;
  const hasEdits = Object.keys(localEdits).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('biDataAccessTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('biDataAccessSubtitle')}
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={handleSave}
            disabled={saving || (!hasEdits && saveStatus === 'idle')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all ${
              saveStatus === 'success'
                ? 'bg-emerald-500'
                : saveStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-[var(--color-accent)] hover:opacity-90'
            } ${(!hasEdits && saveStatus === 'idle') ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveStatus === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : saveStatus === 'error' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving
              ? t('biSaving')
              : saveStatus === 'success'
                ? t('biSaveSuccess')
                : saveStatus === 'error'
                  ? t('biSaveFailed')
                  : t('saveChanges')}
          </button>
        )}
      </div>

      {/* Tool selector */}
      <div className="flex gap-2">
        {(tools.length > 0 ? tools : []).filter((t) => t.status === 'active').map((tool) => {
          const Icon = ICON_MAP[tool.tool] ?? BarChart3;
          const color = COLOR_MAP[tool.tool] ?? '#6366F1';
          const label = tool.displayName[locale] ?? tool.displayName.en ?? tool.tool;
          return (
            <button
              key={tool.tool}
              onClick={() => { setSelectedTool(tool.tool); setLocalEdits({}); }}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                selectedTool === tool.tool
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">{t('biLoadingRoles')}</span>
        </div>
      )}

      {/* No rules message */}
      {!isLoading && roles.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('biNoRulesYet')}</p>
        </div>
      )}

      {/* Role configurations */}
      {!isLoading && roles.length > 0 && (
        <div className="space-y-3">
          {mergedConfigs.map((config) => {
            const { role } = config;
            const isExpanded = expandedRole === role.code;
            const hasNoAccess = config.allowedSchemas.length === 0;
            const roleName = role.name[locale] ?? role.name.en ?? role.code;
            const roleColor = role.color || LEVEL_COLORS[role.level] || '#64748B';
            const levelColor = LEVEL_COLORS[role.level] || '#64748B';

            return (
              <div
                key={role.code}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                {/* Role header */}
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : role.code)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: roleColor }}
                    >
                      {roleName.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{roleName}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: levelColor }}
                      >
                        {role.level}
                      </span>
                      {hasNoAccess && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          {t('noBiAccess')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                      {config.allowedSchemas.length > 0 && (
                        <span>{config.allowedSchemas.length} {t('schemas')}</span>
                      )}
                      {config.allowedTables.length > 0 && (
                        <span>{config.allowedTables.length} {t('tables')}</span>
                      )}
                      {config.allowedTables.length === 0 && config.allowedSchemas.length > 0 && (
                        <span>{t('allTables')}</span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-5 dark:border-slate-800 space-y-5">
                    {/* Schemas */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('schemas')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SCHEMAS.map((schema) => {
                          const enabled = config.allowedSchemas.includes(schema);
                          return (
                            <button
                              key={schema}
                              onClick={() => isSuperAdmin && toggleSchema(role.code, schema, config.allowedSchemas)}
                              disabled={!isSuperAdmin}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                enabled
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400'
                                  : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                              } ${isSuperAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                            >
                              {enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              {schema}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tables */}
                    {config.allowedSchemas.length > 0 && (
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {t('allowedTables')}
                          {config.allowedTables.length === 0 && (
                            <span className="ml-2 text-[10px] normal-case font-normal text-slate-300 dark:text-slate-600">
                              {t('emptyAllAccessible')}
                            </span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {PUBLIC_TABLES.filter((t) => !SENSITIVE_TABLES.includes(t)).map((table) => {
                            const isExcluded = config.excludedTables.includes(table);
                            const isAllowed =
                              config.allowedTables.length === 0
                                ? !isExcluded
                                : config.allowedTables.includes(table);

                            return (
                              <button
                                key={table}
                                onClick={() => isSuperAdmin && toggleTable(role.code, table, config.allowedTables)}
                                disabled={!isSuperAdmin || isExcluded}
                                className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                                  isExcluded
                                    ? 'border-red-100 bg-red-50/50 text-red-300 cursor-not-allowed line-through dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-800'
                                    : isAllowed
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400'
                                      : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                                } ${isSuperAdmin && !isExcluded ? 'cursor-pointer hover:opacity-80' : ''}`}
                                title={isExcluded ? `${table} is excluded (sensitive)` : table}
                              >
                                {table}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Excluded tables */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('alwaysExcluded')}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {config.excludedTables.map((table) => (
                          <span
                            key={table}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-500 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400"
                          >
                            <ShieldCheck className="mr-1 inline h-3 w-3" />
                            {table}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Data filter */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('dataFilterRls')}
                      </label>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {role.level === 'CONTINENTAL'
                          ? t('biFilterContinental')
                          : role.level === 'REGIONAL'
                            ? t('biFilterRegional')
                            : t('biFilterNational')}
                      </p>
                    </div>

                    {/* Permissions */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('permissions')}
                      </label>
                      <div className="flex flex-wrap gap-4">
                        {([
                          { key: 'canCreateDashboard' as const, label: t('createDashboards') },
                          { key: 'canExportData' as const, label: t('exportData') },
                          { key: 'canUseSqlLab' as const, label: t('sqlLabSuperset') },
                        ]).map(({ key, label }) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <button
                              onClick={() => isSuperAdmin && togglePermission(role.code, key, config[key])}
                              disabled={!isSuperAdmin}
                              className={`relative h-5 w-9 rounded-full transition-colors ${
                                config[key]
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-200 dark:bg-slate-700'
                              } ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                  config[key] ? 'left-[18px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Available Tables Reference */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('availableTablesRef')}</h2>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {t('availableTablesRefDesc')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                <th className="px-5 py-3 text-xs font-medium text-slate-400">{t('schema')}</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400">{t('table')}</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400">{t('category')}</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">{t('sensitive')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {PUBLIC_TABLES.map((table) => {
                const isSensitive = SENSITIVE_TABLES.includes(table);
                const category = getTableCategory(table);

                return (
                  <tr key={table} className={isSensitive ? 'bg-red-50/30 dark:bg-red-900/5' : ''}>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-400">public</td>
                    <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{table}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{category}</td>
                    <td className="px-5 py-2.5 text-center">
                      {isSensitive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          <ShieldCheck className="h-3 w-3" />
                          {t('yes')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">{t('no')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
