'use client';

import { type ReactNode } from 'react';
import { usePublicPlatformConfig } from '@/hooks/usePlatformConfig';
import { useTranslations } from '@/lib/i18n/translations';

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { name, fullName } = usePublicPlatformConfig();
  const t = useTranslations('auth');

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-aris-primary-700 via-aris-primary-600 to-aris-secondary-700 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">{name}</h1>
            <p className="mt-1 text-lg text-aris-primary-200">
              {fullName}
            </p>
          </div>
          <p className="text-aris-primary-100 leading-relaxed">
            {t('continentalInfraDesc')}
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-2xl font-bold">55</p>
              <p className="text-xs text-aris-primary-200">{t('memberStates')}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-aris-primary-200">{t('recs')}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-2xl font-bold">9</p>
              <p className="text-xs text-aris-primary-200">{t('domains')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
