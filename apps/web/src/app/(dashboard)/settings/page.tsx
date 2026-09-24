'use client';

import React from 'react';
import Link from 'next/link';
import {
  Globe, Flag, Cog, Shield, ShieldAlert, Bell, Languages, ShieldCheck,
  Layers, ClipboardList, Server, Briefcase, Users, GitPullRequestArrow,
  Link2, BarChart3, Building2, TrendingUp, Activity, Wand2, Monitor,
  Network, Sparkles, RefreshCw, Globe2, Radio, Wrench,
  ChevronLeft, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useTranslations } from '@/lib/i18n/translations';

interface SettingsItem {
  href: string;
  label: string;
  desc?: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  section: string;
}

interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}

export default function SettingsOverviewPage() {
  const { canViewSection, isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const t = useTranslations('settings');

  const groups: SettingsGroup[] = [
    {
      title: 'Organization',
      items: [
        { href: '/settings/recs', label: t('recsManagement'), desc: 'Regional Economic Communities', icon: <Globe className="h-[18px] w-[18px]" />, iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', section: 'recs' },
        { href: '/settings/countries', label: t('countriesManagement'), desc: '55 Member States', icon: <Flag className="h-[18px] w-[18px]" />, iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10', section: 'countries' },
        { href: '/settings/functions', label: t('functions'), desc: 'Organizational roles', icon: <Briefcase className="h-[18px] w-[18px]" />, iconColor: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-500/10', section: 'functions' },
        { href: '/settings/onboarding', label: t('onboardingTitle') !== 'onboardingTitle' ? t('onboardingTitle') : 'Onboarding', desc: 'Country activation', icon: <Globe2 className="h-[18px] w-[18px]" />, iconColor: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-500/10', section: 'onboarding' },
      ],
    },
    {
      title: 'Users & Security',
      items: [
        { href: '/settings/users', label: t('users'), desc: 'Accounts & access', icon: <Users className="h-[18px] w-[18px]" />, iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10', section: 'users' },
        { href: '/settings/roles', label: t('rolesPermissions'), desc: 'RBAC configuration', icon: <ShieldAlert className="h-[18px] w-[18px]" />, iconColor: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-500/10', section: 'roles' },
        { href: '/settings/security', label: t('security'), desc: 'MFA, passwords', icon: <Shield className="h-[18px] w-[18px]" />, iconColor: 'text-red-500 dark:text-red-400', iconBg: 'bg-red-50 dark:bg-red-500/10', section: 'security' },
        { href: '/settings/sessions', label: t('sessions') !== 'sessions' ? t('sessions') : 'Sessions', desc: 'Active sessions', icon: <Monitor className="h-[18px] w-[18px]" />, iconColor: 'text-slate-500 dark:text-slate-400', iconBg: 'bg-slate-50 dark:bg-slate-500/10', section: 'sessions' },
        { href: '/settings/audit', label: t('auditLog'), desc: 'Activity log', icon: <ClipboardList className="h-[18px] w-[18px]" />, iconColor: 'text-orange-500 dark:text-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-500/10', section: 'audit' },
      ],
    },
    {
      title: 'General',
      items: [
        { href: '/settings/general', label: t('generalSettings'), desc: 'Platform preferences', icon: <Cog className="h-[18px] w-[18px]" />, iconColor: 'text-gray-500 dark:text-gray-400', iconBg: 'bg-gray-100 dark:bg-gray-500/10', section: 'general' },
        { href: '/settings/notifications', label: t('notificationsSettings'), desc: 'Email & push alerts', icon: <Bell className="h-[18px] w-[18px]" />, iconColor: 'text-amber-500 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10', section: 'notifications' },
        { href: '/settings/i18n', label: t('languages'), desc: 'EN, FR, PT, AR, SW', icon: <Languages className="h-[18px] w-[18px]" />, iconColor: 'text-indigo-500 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-500/10', section: 'i18n' },
        { href: '/settings/translations', label: t('translations'), desc: 'UI translations', icon: <Wand2 className="h-[18px] w-[18px]" />, iconColor: 'text-pink-500 dark:text-pink-400', iconBg: 'bg-pink-50 dark:bg-pink-500/10', section: 'translations' },
      ],
    },
    {
      title: 'Data & Domains',
      items: [
        { href: '/settings/domains', label: t('domains'), desc: 'Business domains', icon: <Layers className="h-[18px] w-[18px]" />, iconColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10', section: 'domains' },
        { href: '/settings/sub-domains', label: t('subDomains') !== 'subDomains' ? t('subDomains') : 'Sub-domains', desc: 'Domain categories', icon: <Network className="h-[18px] w-[18px]" />, iconColor: 'text-sky-500 dark:text-sky-400', iconBg: 'bg-sky-50 dark:bg-sky-500/10', section: 'sub-domains' },
        { href: '/settings/data-quality', label: t('dataQuality'), desc: 'Quality gates', icon: <ShieldCheck className="h-[18px] w-[18px]" />, iconColor: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-50 dark:bg-green-500/10', section: 'data-quality' },
        { href: '/settings/statistics', label: t('statistics'), desc: 'Stats config', icon: <TrendingUp className="h-[18px] w-[18px]" />, iconColor: 'text-emerald-500 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', section: 'statistics' },
        { href: '/settings/indicator-types', label: t('indicatorTypes') !== 'indicatorTypes' ? t('indicatorTypes') : 'Indicator Types', icon: <BarChart3 className="h-[18px] w-[18px]" />, iconColor: 'text-purple-500 dark:text-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-500/10', section: 'indicator-types' },
        { href: '/settings/indicators', label: t('indicators') !== 'indicators' ? t('indicators') : 'Indicators', desc: 'KPI definitions', icon: <Activity className="h-[18px] w-[18px]" />, iconColor: 'text-rose-500 dark:text-rose-400', iconBg: 'bg-rose-50 dark:bg-rose-500/10', section: 'indicators' },
        { href: '/settings/infrastructures', label: t('infraTypes'), desc: 'Infrastructure types', icon: <Building2 className="h-[18px] w-[18px]" />, iconColor: 'text-stone-500 dark:text-stone-400', iconBg: 'bg-stone-50 dark:bg-stone-500/10', section: 'infrastructures' },
      ],
    },
    {
      title: 'Workflow & Integration',
      items: [
        { href: '/settings/workflow', label: t('workflowConfig'), desc: 'Validation engine', icon: <GitPullRequestArrow className="h-[18px] w-[18px]" />, iconColor: 'text-fuchsia-500 dark:text-fuchsia-400', iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', section: 'workflow' },
        { href: '/settings/validation-chains', label: t('validationChains'), desc: 'Approval chains', icon: <Link2 className="h-[18px] w-[18px]" />, iconColor: 'text-violet-500 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-500/10', section: 'validation-chains' },
        { href: '/settings/bi-access', label: t('biDataAccess'), desc: 'BI tools access', icon: <BarChart3 className="h-[18px] w-[18px]" />, iconColor: 'text-blue-500 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10', section: 'bi-access' },
        { href: '/settings/ai-console', label: t('aiConsole') !== 'aiConsole' ? t('aiConsole') : 'AI Console', desc: 'AI orchestration', icon: <Sparkles className="h-[18px] w-[18px]" />, iconColor: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-50 dark:bg-yellow-500/10', section: 'ai-console' },
      ],
    },
    {
      title: 'System & Monitoring',
      items: [
        { href: '/settings/monitoring', label: 'Monitoring', desc: '22 microservices', icon: <Activity className="h-[18px] w-[18px]" />, iconColor: 'text-emerald-500 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', section: 'monitoring' },
        { href: '/settings/kafka-health', label: 'Kafka Health', desc: 'Consumer groups', icon: <Radio className="h-[18px] w-[18px]" />, iconColor: 'text-orange-500 dark:text-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-500/10', section: 'kafka-health' },
        { href: '/settings/sync-monitoring', label: 'Sync Monitoring', desc: 'Mobile sync', icon: <RefreshCw className="h-[18px] w-[18px]" />, iconColor: 'text-cyan-500 dark:text-cyan-400', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10', section: 'sync-monitoring' },
        { href: '/settings/config', label: 'Configuration', desc: 'Flags & limits', icon: <Cog className="h-[18px] w-[18px]" />, iconColor: 'text-gray-500 dark:text-gray-400', iconBg: 'bg-gray-100 dark:bg-gray-500/10', section: 'config' },
        { href: '/settings/maintenance', label: 'Maintenance', desc: 'Maintenance mode', icon: <Wrench className="h-[18px] w-[18px]" />, iconColor: 'text-amber-500 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10', section: 'maintenance' },
        { href: '/settings/system', label: t('systemInfo'), desc: 'Version & stack', icon: <Server className="h-[18px] w-[18px]" />, iconColor: 'text-slate-500 dark:text-slate-400', iconBg: 'bg-slate-50 dark:bg-slate-500/10', section: 'system' },
      ],
    },
  ];

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const superAdminOnly = [
          'monitoring', 'kafka-health',
          'sync-monitoring', 'config', 'maintenance', 'system',
        ];
        if (superAdminOnly.includes(item.section)) return isSuperAdmin;
        if (isSuperAdmin || isContinentalAdmin) return true;
        return canViewSection(item.section);
      }),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Back link */}
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t('backToDashboard')}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('manageAccountPrefs')}
        </p>
      </div>

      {/* Groups */}
      {visibleGroups.map((group) => (
        <section key={group.title}>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 pl-1">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3.5 rounded-xl px-4 py-3.5',
                  'bg-white border border-gray-100',
                  'dark:bg-gray-900/60 dark:border-gray-800',
                  'hover:bg-gray-50/80 hover:border-gray-200 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]',
                  'dark:hover:bg-gray-800/60 dark:hover:border-gray-700',
                  'transition-all duration-200 ease-out',
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  item.iconBg, item.iconColor,
                  'transition-transform duration-200 group-hover:scale-105',
                )}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-tight">
                    {item.label}
                  </p>
                  {item.desc && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {item.desc}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
