'use client';

import React from 'react';
import Link from 'next/link';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useTranslations } from '@/lib/i18n/translations';
import {
  Globe,
  Flag,
  Cog,
  Shield,
  Bell,
  Languages,
  ShieldCheck,
  Layers,
  ClipboardList,
  Server,
  ChevronRight,
  GitPullRequestArrow,
  Link2,
  Building2,
} from 'lucide-react';

interface SettingsCard {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  section: string;
  badge?: string;
  color: string;
}

export default function SettingsOverviewPage() {
  const { canViewSection, isSuperAdmin, isContinentalAdmin } = useSettingsAccess();
  const t = useTranslations('settings');

  const SETTINGS_CARDS: SettingsCard[] = [
    {
      href: '/settings/recs',
      label: t('recsManagement'),
      description: t('recsDesc'),
      icon: <Globe className="h-5 w-5" />,
      section: 'recs',
      badge: t('recsCount'),
      color: '#006B3F',
    },
    {
      href: '/settings/countries',
      label: t('countriesManagement'),
      description: t('countriesDesc'),
      icon: <Flag className="h-5 w-5" />,
      section: 'countries',
      badge: t('countriesCount'),
      color: '#1565C0',
    },
    {
      href: '/settings/general',
      label: t('generalSettings'),
      description: t('generalDesc'),
      icon: <Cog className="h-5 w-5" />,
      section: 'general',
      color: '#37474F',
    },
    {
      href: '/settings/security',
      label: t('security'),
      description: t('securityDesc'),
      icon: <Shield className="h-5 w-5" />,
      section: 'security',
      color: '#C62828',
    },
    {
      href: '/settings/notifications',
      label: t('notificationsSettings'),
      description: t('notificationsDesc'),
      icon: <Bell className="h-5 w-5" />,
      section: 'notifications',
      color: '#F57F17',
    },
    {
      href: '/settings/i18n',
      label: t('languages'),
      description: t('languagesDesc'),
      icon: <Languages className="h-5 w-5" />,
      section: 'i18n',
      badge: t('langsCount'),
      color: '#4527A0',
    },
    {
      href: '/settings/data-quality',
      label: t('dataQuality'),
      description: t('dataQualityDesc'),
      icon: <ShieldCheck className="h-5 w-5" />,
      section: 'data-quality',
      color: '#E65100',
    },
    {
      href: '/settings/domains',
      label: t('businessDomains'),
      description: t('businessDomainsDesc'),
      icon: <Layers className="h-5 w-5" />,
      section: 'domains',
      badge: t('domainsCount'),
      color: '#00838F',
    },
    {
      href: '/settings/workflow',
      label: t('workflowConfig'),
      description: t('workflowDesc'),
      icon: <GitPullRequestArrow className="h-5 w-5" />,
      section: 'workflow',
      color: '#7B1FA2',
    },
    {
      href: '/settings/validation-chains',
      label: t('validationChains'),
      description: t('validationChainsDesc'),
      icon: <Link2 className="h-5 w-5" />,
      section: 'validation-chains',
      color: '#0277BD',
    },
    {
      href: '/settings/infrastructures',
      label: t('infrastructureTypes'),
      description: t('infrastructureDesc'),
      icon: <Building2 className="h-5 w-5" />,
      section: 'infrastructures',
      badge: t('categoriesCount'),
      color: '#2E7D32',
    },
    {
      href: '/settings/audit',
      label: t('auditLog'),
      description: t('auditLogDesc'),
      icon: <ClipboardList className="h-5 w-5" />,
      section: 'audit',
      color: '#795548',
    },
    {
      href: '/settings/system',
      label: t('systemInfo'),
      description: t('systemInfoDesc'),
      icon: <Server className="h-5 w-5" />,
      section: 'system',
      color: '#455A64',
    },
  ];

  const visibleCards = SETTINGS_CARDS.filter((card) => {
    if (isSuperAdmin || isContinentalAdmin) return true;
    return canViewSection(card.section);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${card.color}14`, color: card.color }}
            >
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {card.label}
                </p>
                {card.badge && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {card.badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {card.description}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
