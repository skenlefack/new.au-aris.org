'use client';

import React from 'react';
import Link from 'next/link';
import {
  Globe, Flag, Cog, Shield, ShieldAlert, Bell, Languages, ShieldCheck,
  Layers, ClipboardList, Server, Briefcase, Users, GitPullRequestArrow,
  Link2, BarChart3, Building2, TrendingUp, Activity, Wand2, Monitor,
  Network, Sparkles, RefreshCw, Globe2, Radio, Upload, Download, Wrench,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useTranslations } from '@/lib/i18n/translations';

interface SettingsItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  section: string;
}

interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}

export default function SettingsOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const { canViewSection, isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const t = useTranslations('settings');

  const groups: SettingsGroup[] = [
    {
      title: 'Organization',
      items: [
        { href: '/settings/recs', label: t('recsManagement'), icon: <Globe className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', section: 'recs' },
        { href: '/settings/countries', label: t('countriesManagement'), icon: <Flag className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', section: 'countries' },
        { href: '/settings/functions', label: t('functions'), icon: <Briefcase className="h-5 w-5" />, color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30', section: 'functions' },
        { href: '/settings/onboarding', label: t('onboardingTitle') !== 'onboardingTitle' ? t('onboardingTitle') : 'Country Onboarding', icon: <Globe2 className="h-5 w-5" />, color: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/30', section: 'onboarding' },
      ],
    },
    {
      title: 'Users & Security',
      items: [
        { href: '/settings/users', label: t('users'), icon: <Users className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', section: 'users' },
        { href: '/settings/roles', label: t('rolesPermissions'), icon: <ShieldAlert className="h-5 w-5" />, color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30', section: 'roles' },
        { href: '/settings/security', label: t('security'), icon: <Shield className="h-5 w-5" />, color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30', section: 'security' },
        { href: '/settings/sessions', label: t('sessions') !== 'sessions' ? t('sessions') : 'Sessions', icon: <Monitor className="h-5 w-5" />, color: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800', section: 'sessions' },
        { href: '/settings/audit', label: t('auditLog'), icon: <ClipboardList className="h-5 w-5" />, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30', section: 'audit' },
      ],
    },
    {
      title: 'General',
      items: [
        { href: '/settings/general', label: t('generalSettings'), icon: <Cog className="h-5 w-5" />, color: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800', section: 'general' },
        { href: '/settings/notifications', label: t('notificationsSettings'), icon: <Bell className="h-5 w-5" />, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', section: 'notifications' },
        { href: '/settings/i18n', label: t('languages'), icon: <Languages className="h-5 w-5" />, color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30', section: 'i18n' },
        { href: '/settings/translations', label: t('translations'), icon: <Wand2 className="h-5 w-5" />, color: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30', section: 'translations' },
      ],
    },
    {
      title: 'Data & Domains',
      items: [
        { href: '/settings/domains', label: t('domains'), icon: <Layers className="h-5 w-5" />, color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30', section: 'domains' },
        { href: '/settings/sub-domains', label: t('subDomains') !== 'subDomains' ? t('subDomains') : 'Sub-domains', icon: <Network className="h-5 w-5" />, color: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/30', section: 'sub-domains' },
        { href: '/settings/data-quality', label: t('dataQuality'), icon: <ShieldCheck className="h-5 w-5" />, color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30', section: 'data-quality' },
        { href: '/settings/statistics', label: t('statistics'), icon: <TrendingUp className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', section: 'statistics' },
        { href: '/settings/indicator-types', label: t('indicatorTypes') !== 'indicatorTypes' ? t('indicatorTypes') : 'Indicator Types', icon: <BarChart3 className="h-5 w-5" />, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30', section: 'indicator-types' },
        { href: '/settings/indicators', label: t('indicators') !== 'indicators' ? t('indicators') : 'Indicators', icon: <Activity className="h-5 w-5" />, color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30', section: 'indicators' },
        { href: '/settings/infrastructures', label: t('infraTypes'), icon: <Building2 className="h-5 w-5" />, color: 'text-stone-600 bg-stone-50 dark:text-stone-400 dark:bg-stone-900/30', section: 'infrastructures' },
      ],
    },
    {
      title: 'Workflow & Validation',
      items: [
        { href: '/settings/workflow', label: t('workflowConfig'), icon: <GitPullRequestArrow className="h-5 w-5" />, color: 'text-fuchsia-600 bg-fuchsia-50 dark:text-fuchsia-400 dark:bg-fuchsia-900/30', section: 'workflow' },
        { href: '/settings/validation-chains', label: t('validationChains'), icon: <Link2 className="h-5 w-5" />, color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30', section: 'validation-chains' },
        { href: '/settings/bi-access', label: t('biDataAccess'), icon: <BarChart3 className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', section: 'bi-access' },
        { href: '/settings/ai-console', label: t('aiConsole') !== 'aiConsole' ? t('aiConsole') : 'AI Console', icon: <Sparkles className="h-5 w-5" />, color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30', section: 'ai-console' },
      ],
    },
    {
      title: 'System & Monitoring',
      items: [
        { href: '/settings/monitoring', label: 'Monitoring', icon: <Activity className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', section: 'monitoring' },
        { href: '/settings/kafka-health', label: 'Kafka Health', icon: <Radio className="h-5 w-5" />, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30', section: 'kafka-health' },
        { href: '/settings/sync-monitoring', label: 'Sync Monitoring', icon: <RefreshCw className="h-5 w-5" />, color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30', section: 'sync-monitoring' },
        { href: '/settings/config', label: 'Configuration', icon: <Cog className="h-5 w-5" />, color: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800', section: 'config' },
        { href: '/settings/maintenance', label: 'Maintenance', icon: <Wrench className="h-5 w-5" />, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', section: 'maintenance' },
        { href: '/settings/system', label: t('systemInfo'), icon: <Server className="h-5 w-5" />, color: 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/30', section: 'system' },
      ],
    },
  ];

  // Filter items by access
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/home"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('backToDashboard')}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('manageAccountPrefs')}</p>
      </div>

      {/* User card */}
      {user && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('welcomeBack')},{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {user.firstName} {user.lastName}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {user.email} &middot; {user.role.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Groups */}
      {visibleGroups.map((group) => (
        <div key={group.title}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            {group.title}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-4
                  hover:border-gray-200 hover:shadow-sm hover:-translate-y-0.5
                  dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700
                  transition-all duration-150"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color} transition-transform group-hover:scale-110`}>
                  {item.icon}
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
