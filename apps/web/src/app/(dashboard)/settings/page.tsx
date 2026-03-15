'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  Shield,
  Bell,
  Globe,
  Palette,
  Database,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

interface SettingsCard {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export default function SettingsOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const t = useTranslations('settings');

  const SETTINGS_CARDS: SettingsCard[] = [
    {
      href: '/settings/profile',
      label: t('profile'),
      description: t('profileDesc'),
      icon: <User className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      href: '/settings/security',
      label: t('security'),
      description: t('securityDesc'),
      icon: <Shield className="h-5 w-5" />,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      href: '/settings/notifications',
      label: t('notificationsSettings'),
      description: t('notificationsDesc'),
      icon: <Bell className="h-5 w-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      href: '/settings/language',
      label: t('languageRegion'),
      description: t('languageRegionDesc'),
      icon: <Globe className="h-5 w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      href: '/settings/appearance',
      label: t('appearance'),
      description: t('appearanceDesc'),
      icon: <Palette className="h-5 w-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      href: '/settings/data',
      label: t('dataPrivacy'),
      description: t('dataPrivacyDesc'),
      icon: <Database className="h-5 w-5" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('manageAccountPrefs')}
        </p>
      </div>

      {user && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.bgColor} ${card.color}`}
            >
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {card.label}
              </p>
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
