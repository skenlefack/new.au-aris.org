'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRefDataCounts } from '@/lib/api/ref-data-hooks';
import {
  DOMAIN_CONFIG,
  getTypesByDomain,
  type DomainConfig,
} from '@/components/master-data/ref-data-config';
import { useTranslations } from '@/lib/i18n/translations';

function ScopeBadge({ scope }: { scope: string }) {
  const t = useTranslations('masterData');
  const styles: Record<string, string> = {
    continental: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    regional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    national: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', styles[scope] ?? 'bg-gray-100 text-gray-600')}>
      {t(scope)}
    </span>
  );
}

function DomainSection({
  domain,
  counts,
  isLoading,
}: {
  domain: DomainConfig;
  counts: Record<string, number>;
  isLoading: boolean;
}) {
  const t = useTranslations('masterData');
  const types = getTypesByDomain(domain.slug);
  const DomainIcon = domain.icon;
  const totalCount = types.reduce((sum, tp) => sum + (counts[tp.slug] ?? 0), 0);

  return (
    <section className="space-y-3">
      {/* Domain header */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        domain.bgColor, 'border-transparent',
        'dark:bg-opacity-10 dark:border-gray-700',
      )}>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 shadow-sm', 'dark:bg-gray-800/80')}>
          <DomainIcon className={cn('h-5 w-5', domain.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {domain.label}
            </h2>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800/60 dark:text-gray-400">
              {types.length} {t('types')}
            </span>
            {!isLoading && (
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                {totalCount} {t('records')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            {domain.descriptionFr}
          </p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {types.map((typeConfig) => {
          const Icon = typeConfig.icon;
          const count = counts[typeConfig.slug] ?? 0;

          return (
            <Link
              key={typeConfig.slug}
              href={`/master-data/${typeConfig.slug}`}
              className={cn(
                'group relative flex flex-col rounded-xl border border-gray-200 bg-white p-4',
                'transition-all duration-200 hover:border-gray-300 hover:shadow-md',
                'dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600',
              )}
            >
              <div className="flex items-start justify-between">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', typeConfig.bgColor, 'dark:bg-opacity-20')}>
                  <Icon className={cn('h-4 w-4', typeConfig.color)} />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {isLoading ? (
                    <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  ) : (
                    count
                  )}
                </span>
              </div>

              <h3 className="mt-2 text-sm font-semibold text-gray-900 group-hover:text-aris-primary-600 dark:text-white dark:group-hover:text-aris-primary-400">
                {typeConfig.label}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {typeConfig.labelFr}
              </p>

              <div className="absolute bottom-3 right-3 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function MasterDataDashboard() {
  const t = useTranslations('masterData');
  const { data: countsData, isLoading } = useRefDataCounts();
  const counts = countsData?.data ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      {/* Scope legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('scopeLegend')}</span>
        <ScopeBadge scope="continental" />
        <span className="text-xs text-gray-400">{t('visibleByAll')}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <ScopeBadge scope="regional" />
        <span className="text-xs text-gray-400">{t('recMemberStates')}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <ScopeBadge scope="national" />
        <span className="text-xs text-gray-400">{t('countryOnly')}</span>
      </div>

      {/* Domain sections */}
      <div className="space-y-10">
        {DOMAIN_CONFIG.map((domain) => (
          <DomainSection
            key={domain.slug}
            domain={domain}
            counts={counts}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
