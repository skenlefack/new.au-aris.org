'use client';

import { Building2, Calendar, Users } from 'lucide-react';
import { LandingHeader } from './LandingHeader';
import { CountryCard } from './CountryCard';
import { LoginPanel } from './LoginPanel';
import { StatsCounter } from './StatsCounter';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { getLocalizedField } from '@/lib/i18n/localize';
import type { RecConfig } from '@/data/recs-config';
import type { CountryConfig } from '@/data/countries-config';

interface RecPageContentProps {
  rec: RecConfig;
  countries: CountryConfig[];
  interopCount: number;
  activeCount: number;
}

export function RecPageContent({ rec, countries, interopCount, activeCount }: RecPageContentProps) {
  const t = useTranslations('landing');
  const locale = useLocaleStore((s) => s.locale);

  const recName = getLocalizedField(rec, 'name', locale);
  const recFullName = getLocalizedField(rec, 'fullName', locale);
  const recDescription = getLocalizedField(rec, 'description', locale);

  const totalPopulation = countries.reduce((sum, c) => sum + c.population, 0);

  return (
    <>
      <LandingHeader rec={rec} />

      {/* Hero banner with REC color */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${rec.color}, ${rec.colorDark})`,
        }}
      >
        {/* Gold accent */}
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#D4A843] via-[#E8C875] to-[#D4A843]" />

        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />

        <div className="relative mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Title */}
            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-[#D4A843]" />
                {t('recBadge')}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                {recName}
              </h1>
              <p className="mt-0.5 text-sm font-medium text-white/80">
                {recFullName}
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/70">
                {recDescription}
              </p>
            </div>

            {/* Right: Stats */}
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <StatBox icon={Users} label={t('memberStates')} value={rec.memberCount} />
              <StatBox icon={Building2} label={t('headquarters')} value={rec.headquarters} />
              <StatBox icon={Calendar} label={t('established')} value={rec.establishedYear} />
            </div>
          </div>
        </div>
      </section>

      {/* Content: Countries grid + Login */}
      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row">
          {/* Left: Countries */}
          <div className="flex-1">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('memberStates')}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {countries.length} {t('countriesLabel')} &bull; {totalPopulation.toFixed(0)}M {t('totalPopulation')}
                  {activeCount > 0 && ` \u2022 ${t('activeOnArisCount', { count: String(activeCount) })}`}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {countries.map((country) => (
                <CountryCard
                  key={country.code}
                  country={country}
                  accentColor={rec.color}
                />
              ))}
            </div>

            {/* Regional statistics */}
            <div className="mt-10 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                {t('regionalOverview')}
              </h3>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <StatsCounter
                  value={countries.length}
                  label={t('countriesLabel')}
                  valueClassName="text-gray-900 dark:text-white"
                  labelClassName="text-gray-500"
                />
                <StatsCounter
                  value={Math.round(totalPopulation)}
                  suffix="M"
                  label={t('populationLabel')}
                  valueClassName="text-gray-900 dark:text-white"
                  labelClassName="text-gray-500"
                />
                <StatsCounter
                  value={activeCount}
                  label={t('activeOnAris')}
                  valueClassName="dark:text-white"
                  labelClassName="text-gray-500"
                  className=""
                />
                <StatsCounter
                  value={interopCount}
                  label={t('interoperability')}
                  valueClassName="text-gray-900 dark:text-white"
                  labelClassName="text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Right: Login Panel */}
          <div className="lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <LoginPanel
                  context={{
                    level: 'rec',
                    name: recName,
                    color: rec.color,
                    recCode: rec.code,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-white/70">
        <Icon className="h-3 w-3" />
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}
