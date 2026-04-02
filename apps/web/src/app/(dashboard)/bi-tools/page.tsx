'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, PieChart, BarChart2, ArrowRight, CheckCircle2, Shield, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useTranslations } from '@/lib/i18n/translations';
import { useBiTools, useBiAccessRulesForRole, type BiToolConfig } from '@/lib/api/bi-hooks';

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

const HREF_MAP: Record<string, string> = {
  superset: '/bi-tools/superset',
  metabase: '/bi-tools/metabase',
  grafana: '/bi-tools/grafana',
};

const FEATURES_MAP: Record<string, string[]> = {
  superset: ['SQL Lab', 'Custom Dashboards', 'Chart Builder', 'Data Exploration'],
  metabase: ['Question Builder', 'Auto Dashboards', 'Alerts', 'Collections'],
  grafana: ['Dashboard Builder', 'PostgreSQL Queries', 'Variables & Drill-down', 'Alerting'],
};

export default function BiToolsPage() {
  const t = useTranslations('biTools');
  const user = useAuthStore((s) => s.user);
  const locale = useLocaleStore((s) => s.locale);

  // Fetch tools from API
  const { data: toolsData, isLoading: toolsLoading } = useBiTools();
  const tools = (toolsData?.data ?? []).filter((t) => t.status === 'active');

  // Fetch user's access rules
  const { data: rulesData, isLoading: rulesLoading } = useBiAccessRulesForRole(user?.role ?? '');
  const userRules = rulesData?.data ?? [];

  const accessLabel = user?.tenantLevel === 'CONTINENTAL'
    ? t('allMemberStates')
    : user?.tenantLevel === 'REC'
      ? t('regionalCountries')
      : t('countryData');

  const isLoading = toolsLoading || rulesLoading;

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Access level indicator */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('dataAccessLevel')}</p>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{accessLabel}</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">{t('loadingTools')}</span>
        </div>
      )}

      {/* Tool Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = ICON_MAP[tool.tool] ?? BarChart3;
            const color = COLOR_MAP[tool.tool] ?? '#6366F1';
            const href = HREF_MAP[tool.tool] ?? '/bi-tools';
            const features = FEATURES_MAP[tool.tool] ?? [];
            const displayName = tool.displayName[locale] ?? tool.displayName.en ?? tool.tool;
            const description = tool.description?.[locale] ?? tool.description?.en ?? '';

            // Check if user has access to this tool
            const toolRule = userRules.find((r) => r.tool === tool.tool);
            const hasAccess = toolRule ? toolRule.allowedSchemas.length > 0 : true; // fallback: allow if no rules fetched

            return (
              <div
                key={tool.tool}
                className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 transition-shadow ${
                  hasAccess
                    ? 'border-slate-200 dark:border-slate-700 hover:shadow-lg'
                    : 'border-slate-200/60 dark:border-slate-700/60 opacity-70'
                }`}
              >
                {/* Color accent bar */}
                <div className="h-1.5" style={{ backgroundColor: hasAccess ? color : '#94A3B8' }} />

                <div className="p-6">
                  {/* Icon + Name */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${hasAccess ? color : '#94A3B8'}15` }}
                      >
                        <Icon className="h-6 w-6" style={{ color: hasAccess ? color : '#94A3B8' }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{displayName}</h3>
                        {hasAccess ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('autoConnected')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <Lock className="h-3 w-3" />
                            {t('noAccess')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {description}
                  </p>

                  {/* Features */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {features.map((f) => (
                      <span
                        key={f}
                        className="rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-6">
                    {hasAccess ? (
                      <Link
                        href={href}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: color }}
                      >
                        {t('openInAris')}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500">
                        <Lock className="h-4 w-4" />
                        {t('accessDenied')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('howItWorks')}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('howItWorksDesc')}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoCard
            label={t('authentication')}
            value={t('automaticSso')}
            detail={t('noSeparateLogin')}
          />
          <InfoCard
            label={t('dataFiltering')}
            value={t('tenantScoped')}
            detail={t('onlyAuthorizedData')}
          />
          <InfoCard
            label={t('databaseAccess')}
            value={t('readOnly')}
            detail={t('sensitiveExcluded')}
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{detail}</p>
    </div>
  );
}
