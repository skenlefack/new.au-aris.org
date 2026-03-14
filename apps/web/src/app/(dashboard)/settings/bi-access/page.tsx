'use client';

import React, { useState, useMemo } from 'react';
import { BarChart3, PieChart, BarChart2, ShieldCheck, Eye, EyeOff, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';

/* ── Types ── */

interface BiTool {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  status: 'active' | 'coming_soon';
}

interface RoleConfig {
  role: string;
  label: string;
  color: string;
  allowedSchemas: string[];
  allowedTables: string[];
  excludedTables: string[];
  dataFilter: string;
  canCreateDashboard: boolean;
  canExportData: boolean;
  canUseSqlLab: boolean;
}

/* ── Constants ── */

const BI_TOOLS: BiTool[] = [
  { id: 'superset', name: 'Apache Superset', icon: BarChart3, color: '#1FC2A7', status: 'active' },
  { id: 'metabase', name: 'Metabase', icon: PieChart, color: '#509EE3', status: 'active' },
  { id: 'grafana', name: 'Grafana', icon: BarChart2, color: '#FF6600', status: 'active' },
];

const SCHEMAS = ['public', 'historical'];

const SENSITIVE_TABLES = ['User', 'Session', 'RefreshToken', 'AuditLog', 'ApiKey', '_prisma_migrations'];

// Tables available in the ARIS public schema
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

const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    color: '#DC2626',
    allowedSchemas: ['public', 'historical'],
    allowedTables: [],
    excludedTables: ['User', 'Session', 'RefreshToken', 'AuditLog'],
    dataFilter: 'None (full access)',
    canCreateDashboard: true,
    canExportData: true,
    canUseSqlLab: true,
  },
  {
    role: 'CONTINENTAL_ADMIN',
    label: 'Continental Admin',
    color: '#D97706',
    allowedSchemas: ['public', 'historical'],
    allowedTables: [],
    excludedTables: ['User', 'Session', 'RefreshToken', 'AuditLog'],
    dataFilter: 'None (full access)',
    canCreateDashboard: true,
    canExportData: true,
    canUseSqlLab: true,
  },
  {
    role: 'REC_ADMIN',
    label: 'REC Admin',
    color: '#7C3AED',
    allowedSchemas: ['public', 'historical'],
    allowedTables: [
      'Country', 'Disease', 'Species', 'GeoEntity',
      'CollecteSubmission', 'CollecteCampaign',
      'HealthEvent', 'LabResult', 'Vaccination', 'Surveillance',
      'LivestockCensus', 'ProductionRecord',
      'FisheryCapture', 'TradeFlow', 'MarketPrice',
    ],
    excludedTables: ['User', 'Session', 'RefreshToken', 'AuditLog', 'Tenant', 'FormTemplate'],
    dataFilter: 'Automatic (filtered by REC countries)',
    canCreateDashboard: false,
    canExportData: true,
    canUseSqlLab: false,
  },
  {
    role: 'NATIONAL_ADMIN',
    label: 'National Admin',
    color: '#2563EB',
    allowedSchemas: ['public', 'historical'],
    allowedTables: [
      'Country', 'Disease', 'Species', 'GeoEntity',
      'CollecteSubmission', 'CollecteCampaign',
      'HealthEvent', 'LabResult', 'Vaccination', 'Surveillance',
      'LivestockCensus', 'ProductionRecord',
      'FisheryCapture', 'TradeFlow', 'MarketPrice',
    ],
    excludedTables: ['User', 'Session', 'RefreshToken', 'AuditLog', 'Tenant', 'FormTemplate'],
    dataFilter: 'Automatic (filtered by country_code)',
    canCreateDashboard: false,
    canExportData: true,
    canUseSqlLab: false,
  },
  {
    role: 'DATA_STEWARD',
    label: 'Data Steward',
    color: '#059669',
    allowedSchemas: ['public', 'historical'],
    allowedTables: [
      'Country', 'Disease', 'Species', 'GeoEntity',
      'CollecteSubmission', 'CollecteCampaign',
      'HealthEvent', 'Surveillance',
      'LivestockCensus',
    ],
    excludedTables: ['User', 'Session', 'RefreshToken', 'AuditLog', 'Tenant'],
    dataFilter: 'Automatic (filtered by assigned scope)',
    canCreateDashboard: false,
    canExportData: true,
    canUseSqlLab: false,
  },
  {
    role: 'ANALYST',
    label: 'Analyst',
    color: '#0891B2',
    allowedSchemas: ['public'],
    allowedTables: [
      'Country', 'Disease', 'Species', 'GeoEntity',
      'HealthEvent', 'Surveillance',
      'LivestockCensus', 'ProductionRecord',
      'FisheryCapture', 'TradeFlow', 'MarketPrice',
    ],
    excludedTables: SENSITIVE_TABLES,
    dataFilter: 'Read-only aggregated data',
    canCreateDashboard: false,
    canExportData: true,
    canUseSqlLab: false,
  },
  {
    role: 'FIELD_AGENT',
    label: 'Field Agent',
    color: '#64748B',
    allowedSchemas: [],
    allowedTables: [],
    excludedTables: SENSITIVE_TABLES,
    dataFilter: 'No BI access',
    canCreateDashboard: false,
    canExportData: false,
    canUseSqlLab: false,
  },
];

/* ── Page ── */

export default function BiAccessPage() {
  const t = useTranslations('settings');
  const { user } = useAuthStore();
  const [selectedTool, setSelectedTool] = useState('superset');
  const [expandedRole, setExpandedRole] = useState<string | null>('SUPER_ADMIN');
  const [configs, setConfigs] = useState<RoleConfig[]>(ROLE_CONFIGS);
  const [saved, setSaved] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'CONTINENTAL_ADMIN';

  const activeTool = BI_TOOLS.find((t) => t.id === selectedTool)!;

  const toggleTable = (roleIdx: number, table: string) => {
    setConfigs((prev) => {
      const updated = [...prev];
      const role = { ...updated[roleIdx] };
      const tables = [...role.allowedTables];
      const idx = tables.indexOf(table);
      if (idx >= 0) {
        tables.splice(idx, 1);
      } else {
        tables.push(table);
      }
      role.allowedTables = tables;
      updated[roleIdx] = role;
      return updated;
    });
    setSaved(false);
  };

  const togglePermission = (roleIdx: number, perm: 'canCreateDashboard' | 'canExportData' | 'canUseSqlLab') => {
    setConfigs((prev) => {
      const updated = [...prev];
      const role = { ...updated[roleIdx] };
      role[perm] = !role[perm];
      updated[roleIdx] = role;
      return updated;
    });
    setSaved(false);
  };

  const toggleSchema = (roleIdx: number, schema: string) => {
    setConfigs((prev) => {
      const updated = [...prev];
      const role = { ...updated[roleIdx] };
      const schemas = [...role.allowedSchemas];
      const idx = schemas.indexOf(schema);
      if (idx >= 0) {
        schemas.splice(idx, 1);
      } else {
        schemas.push(schema);
      }
      role.allowedSchemas = schemas;
      updated[roleIdx] = role;
      return updated;
    });
    setSaved(false);
  };

  const handleSave = () => {
    // In production this would POST to /api/v1/bi/access-rules
    // For now, save to localStorage
    localStorage.setItem(`aris-bi-access-${selectedTool}`, JSON.stringify(configs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Save className="h-4 w-4" />
            {saved ? t('saved') : t('saveChanges')}
          </button>
        )}
      </div>

      {/* Tool selector */}
      <div className="flex gap-2">
        {BI_TOOLS.filter((t) => t.status === 'active').map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                selectedTool === tool.id
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tool.name}
            </button>
          );
        })}
      </div>

      {/* Role configurations */}
      <div className="space-y-3">
        {configs.map((roleConfig, roleIdx) => {
          const isExpanded = expandedRole === roleConfig.role;
          const hasNoAccess = roleConfig.allowedSchemas.length === 0;

          return (
            <div
              key={roleConfig.role}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              {/* Role header */}
              <button
                onClick={() => setExpandedRole(isExpanded ? null : roleConfig.role)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: roleConfig.color }}
                  >
                    {roleConfig.label.split(' ').map((w) => w[0]).join('')}
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{roleConfig.label}</span>
                    {hasNoAccess && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        {t('noBiAccess')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                    {roleConfig.allowedSchemas.length > 0 && (
                      <span>{roleConfig.allowedSchemas.length} {t('schemas')}</span>
                    )}
                    {roleConfig.allowedTables.length > 0 && (
                      <span>{roleConfig.allowedTables.length} {t('tables')}</span>
                    )}
                    {roleConfig.allowedTables.length === 0 && roleConfig.allowedSchemas.length > 0 && (
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
                        const enabled = roleConfig.allowedSchemas.includes(schema);
                        return (
                          <button
                            key={schema}
                            onClick={() => isSuperAdmin && toggleSchema(roleIdx, schema)}
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
                  {roleConfig.allowedSchemas.length > 0 && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('allowedTables')}
                        {roleConfig.allowedTables.length === 0 && (
                          <span className="ml-2 text-[10px] normal-case font-normal text-slate-300 dark:text-slate-600">
                            {t('emptyAllAccessible')}
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PUBLIC_TABLES.filter((t) => !SENSITIVE_TABLES.includes(t)).map((table) => {
                          const isExcluded = roleConfig.excludedTables.includes(table);
                          const isAllowed =
                            roleConfig.allowedTables.length === 0
                              ? !isExcluded
                              : roleConfig.allowedTables.includes(table);

                          return (
                            <button
                              key={table}
                              onClick={() => isSuperAdmin && toggleTable(roleIdx, table)}
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

                  {/* Excluded tables (always shown) */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t('alwaysExcluded')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {roleConfig.excludedTables.map((table) => (
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
                    <p className="text-sm text-slate-600 dark:text-slate-300">{roleConfig.dataFilter}</p>
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
                            onClick={() => isSuperAdmin && togglePermission(roleIdx, key)}
                            disabled={!isSuperAdmin}
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              roleConfig[key]
                                ? 'bg-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                            } ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                roleConfig[key] ? 'left-[18px]' : 'left-0.5'
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
                let category = 'Master Data';
                if (table.includes('Health') || table.includes('Lab') || table.includes('Vaccination') || table.includes('Surveillance')) category = 'Animal Health';
                else if (table.includes('Livestock') || table.includes('Production') || table.includes('Slaughter') || table.includes('Transhumance')) category = 'Livestock';
                else if (table.includes('Fish') || table.includes('Vessel') || table.includes('Aquaculture')) category = 'Fisheries';
                else if (table.includes('Trade') || table.includes('Sps') || table.includes('Market')) category = 'Trade & SPS';
                else if (table.includes('Wildlife') || table.includes('Protected') || table.includes('Cites')) category = 'Wildlife';
                else if (table.includes('Apiary') || table.includes('Honey') || table.includes('Colony')) category = 'Apiculture';
                else if (table.includes('Climate') || table.includes('Water') || table.includes('Rangeland')) category = 'Climate & Env';
                else if (table.includes('Collecte') || table.includes('Form')) category = 'Collecte';
                else if (table.includes('Workflow')) category = 'Workflow';
                else if (table.includes('Notification') || table.includes('File')) category = 'System';

                return (
                  <tr key={table} className={isSensitive ? 'bg-red-50/30 dark:bg-red-900/5' : ''}>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-400">public</td>
                    <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{table}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{category}</td>
                    <td className="px-5 py-2.5 text-center">
                      {isSensitive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          <ShieldCheck className="h-3 w-3" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">No</span>
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
