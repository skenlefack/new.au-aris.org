'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileQuestion, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

export default function NotFound() {
  const router = useRouter();
  const t = useTranslations('errors');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-aris-primary-50">
          <FileQuestion className="h-10 w-10 text-aris-primary-500" />
        </div>

        {/* Heading */}
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900">
          404
        </h1>
        <p className="mt-2 text-lg font-semibold text-gray-700">
          {t('pageNotFound')}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {t('pageNotFoundLong')}
        </p>

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

          <button
            onClick={() => router.back()}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium',
              'bg-white text-gray-700 shadow-sm',
              'hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-aris-primary-500 focus-visible:ring-offset-2',
              'transition-colors duration-150',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('goBack')}
          </button>
        </div>

        {/* Branding */}
        <p className="mt-12 text-xs text-gray-400">
          ARIS — {t('arisTagline')}
        </p>
      </div>
    </div>
  );
}
