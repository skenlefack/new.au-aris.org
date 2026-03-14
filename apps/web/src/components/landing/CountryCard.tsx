'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { CountryConfig } from '@/data/countries-config';
import { useTranslations } from '@/lib/i18n/translations';

interface CountryCardProps {
  country: CountryConfig;
  accentColor?: string;
}

export function CountryCard({ country, accentColor = '#006B3F' }: CountryCardProps) {
  const t = useTranslations('landing');
  const isConfigured = !!country.tenantId;

  return (
    <Link
      href={`/country/${country.code}`}
      className="group relative flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Flag */}
      <span className="text-4xl leading-none">{country.flag}</span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
            {country.name}
          </h3>
          {isConfigured && (
            <span
              className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {t('active')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {country.capital} \u2022 {country.population >= 1 ? `${country.population}M` : `${Math.round(country.population * 1000)}K`} {t('pop')}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight
        className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-500"
        style={{ color: isConfigured ? accentColor : undefined }}
      />
    </Link>
  );
}
