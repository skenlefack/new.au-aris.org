'use client';

import React from 'react';
import Link from 'next/link';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
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

const SETTINGS_CARDS: SettingsCard[] = [
  {
    href: '/settings/recs',
    label: 'RECs Management',
    description: '8 Regional Economic Communities with member states',
    icon: <Globe className="h-5 w-5" />,
    section: 'recs',
    badge: '8 RECs',
    color: '#006B3F',
  },
  {
    href: '/settings/countries',
    label: 'Countries Management',
    description: '55 AU Member States with stats and sector performance',
    icon: <Flag className="h-5 w-5" />,
    section: 'countries',
    badge: '55 Countries',
    color: '#1565C0',
  },
  {
    href: '/settings/general',
    label: 'General Settings',
    description: 'Platform name, branding, contact information',
    icon: <Cog className="h-5 w-5" />,
    section: 'general',
    color: '#37474F',
  },
  {
    href: '/settings/security',
    label: 'Security',
    description: 'MFA, passwords, session management, rate limits',
    icon: <Shield className="h-5 w-5" />,
    section: 'security',
    color: '#C62828',
  },
  {
    href: '/settings/notifications',
    label: 'Notifications',
    description: 'Email, SMS, push notification configuration',
    icon: <Bell className="h-5 w-5" />,
    section: 'notifications',
    color: '#F57F17',
  },
  {
    href: '/settings/i18n',
    label: 'Languages & i18n',
    description: '5 languages: EN, FR, PT, AR, ES with RTL support',
    icon: <Languages className="h-5 w-5" />,
    section: 'i18n',
    badge: '5 Langs',
    color: '#4527A0',
  },
  {
    href: '/settings/data-quality',
    label: 'Data Quality',
    description: 'Validation thresholds, completeness, timeliness',
    icon: <ShieldCheck className="h-5 w-5" />,
    section: 'data-quality',
    color: '#E65100',
  },
  {
    href: '/settings/domains',
    label: 'Business Domains',
    description: '9 domains: Animal Health, Fisheries, Trade, etc.',
    icon: <Layers className="h-5 w-5" />,
    section: 'domains',
    badge: '9 Domains',
    color: '#00838F',
  },
  {
    href: '/settings/workflow',
    label: 'Workflow Configuration',
    description: 'Validation workflows per country: steps, delays, auto-transmit',
    icon: <GitPullRequestArrow className="h-5 w-5" />,
    section: 'workflow',
    color: '#7B1FA2',
  },
  {
    href: '/settings/validation-chains',
    label: 'Validation Chains',
    description: 'Define who validates whom at each hierarchy level',
    icon: <Link2 className="h-5 w-5" />,
    section: 'validation-chains',
    color: '#0277BD',
  },
  {
    href: '/settings/audit',
    label: 'Audit Log',
    description: 'Track all configuration changes and modifications',
    icon: <ClipboardList className="h-5 w-5" />,
    section: 'audit',
    color: '#795548',
  },
  {
    href: '/settings/system',
    label: 'System Info',
    description: 'Version, health status, config export/import',
    icon: <Server className="h-5 w-5" />,
    section: 'system',
    color: '#455A64',
  },
];

export default function SettingsOverviewPage() {
  const { canViewSection, isSuperAdmin, isContinentalAdmin } = useSettingsAccess();

  const visibleCards = SETTINGS_CARDS.filter((card) => {
    if (isSuperAdmin || isContinentalAdmin) return true;
    return canViewSection(card.section);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Platform configuration, RECs, countries, and system management
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
