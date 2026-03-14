'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldX, LayoutDashboard, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

interface ForbiddenPageProps {
  requiredRole?: string;
}

const ADMIN_EMAIL = 'admin@au-aris.org';

export function ForbiddenPage({ requiredRole }: ForbiddenPageProps) {
  const t = useTranslations('errors');
  const user = useAuthStore((s) => s.user);
  const currentRole = user?.role ?? 'Unknown';

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <ShieldX className="h-10 w-10 text-red-500" />
        </div>

        {/* Heading */}
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">
          {t('accessDenied')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('noPermission')}
        </p>

        {/* Role info */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{t('yourCurrentRole')}</span>
            <span className="rounded-md bg-gray-200 px-2 py-0.5 font-mono text-xs font-medium text-gray-700">
              {currentRole}
            </span>
          </div>
          {requiredRole && (
            <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
              <span className="text-gray-500">{t('requiredRole')}</span>
              <span className="rounded-md bg-red-100 px-2 py-0.5 font-mono text-xs font-medium text-red-700">
                {requiredRole}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium',
              'bg-aris-primary text-white shadow-sm',
              'hover:bg-aris-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-aris-primary-500 focus-visible:ring-offset-2',
              'transition-colors duration-150',
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            {t('goToDashboard')}
          </Link>

          <a
            href={`mailto:${ADMIN_EMAIL}?subject=ARIS%20Access%20Request&body=Role%20requested%3A%20${encodeURIComponent(requiredRole ?? 'N/A')}%0ACurrent%20role%3A%20${encodeURIComponent(currentRole)}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium',
              'bg-white text-gray-700 shadow-sm',
              'hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-aris-primary-500 focus-visible:ring-offset-2',
              'transition-colors duration-150',
            )}
          >
            <Mail className="h-4 w-4" />
            {t('contactAdmin')}
          </a>
        </div>
      </div>
    </div>
  );
}
