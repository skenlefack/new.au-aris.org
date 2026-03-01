import { redirect } from 'next/navigation';
import { MapPin, Building2, Calendar, Users } from 'lucide-react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { CountryCard } from '@/components/landing/CountryCard';
import { LoginPanel } from '@/components/landing/LoginPanel';
import { StatsCounter } from '@/components/landing/StatsCounter';
import { getRec, type RecConfig } from '@/data/recs-config';
import { getCountriesByRec, type CountryConfig } from '@/data/countries-config';
import { getPublicRecByCode } from '@/lib/api/public-data';

export const revalidate = 300;

interface Props {
  params: { recCode: string };
}

export default async function RecPage({ params }: Props) {
  const recCode = (params.recCode as string)?.toLowerCase();
  const staticRec = recCode ? getRec(recCode) : undefined;
  if (!staticRec) redirect('/');

  const staticCountries = getCountriesByRec(recCode);

  // Attempt live API fetch
  let rec: RecConfig = staticRec;
  let countries: CountryConfig[] = staticCountries;

  try {
    const apiRes = await getPublicRecByCode(recCode);
    const apiRec = apiRes?.data;
    if (apiRec && !apiRec._static) {
      // Merge REC data (keep UI-specific fields from static: colorLight, colorDark, etc.)
      rec = {
        ...staticRec,
        name: apiRec.name?.en ?? staticRec.name,
        fullName: apiRec.fullName?.en ?? staticRec.fullName,
        description: apiRec.description?.en ?? staticRec.description,
        region: apiRec.region?.en ?? staticRec.region,
        headquarters: apiRec.headquarters ?? staticRec.headquarters,
        establishedYear: apiRec.established ?? staticRec.establishedYear,
        memberCount: apiRec.countries?.length ?? staticRec.memberCount,
        color: apiRec.accentColor ?? staticRec.color,
      };

      // Merge country data if API returned countries
      const apiCountries: any[] = apiRec.countries ?? [];
      if (apiCountries.length > 0) {
        countries = staticCountries.map((sc) => {
          const ac = apiCountries.find((c: any) => c.country?.code === sc.code);
          if (!ac?.country) return sc;
          return {
            ...sc,
            name: ac.country.name?.en ?? sc.name,
            capital: ac.country.capital?.en ?? sc.capital,
            flag: ac.country.flag ?? sc.flag,
            population: ac.country.population
              ? ac.country.population / 1_000_000
              : sc.population,
            tenantId: ac.country.tenantId ?? sc.tenantId,
          };
        });
      }
    }
  } catch {
    // Static fallback already assigned
  }

  const totalPopulation = countries.reduce((sum, c) => sum + c.population, 0);
  const configuredCount = countries.filter((c) => c.tenantId).length;

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
                Regional Economic Community
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                {rec.name}
              </h1>
              <p className="mt-0.5 text-sm font-medium text-white/80">
                {rec.fullName}
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/70">
                {rec.description}
              </p>
            </div>

            {/* Right: Stats */}
            <div className="grid grid-cols-4 gap-2 lg:gap-3">
              <StatBox icon={Users} label="Members" value={rec.memberCount} />
              <StatBox icon={MapPin} label="Region" value={rec.region} />
              <StatBox icon={Building2} label="HQ" value={rec.headquarters} />
              <StatBox icon={Calendar} label="Est." value={rec.establishedYear} />
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
                  Member States
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {countries.length} countries &bull; {totalPopulation.toFixed(0)}M total population
                  {configuredCount > 0 && ` \u2022 ${configuredCount} active on ARIS`}
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
                Regional Overview
              </h3>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <StatsCounter
                  value={countries.length}
                  label="Countries"
                  valueClassName="text-gray-900 dark:text-white"
                  labelClassName="text-gray-500"
                />
                <StatsCounter
                  value={Math.round(totalPopulation)}
                  suffix="M"
                  label="Population"
                  valueClassName="text-gray-900 dark:text-white"
                  labelClassName="text-gray-500"
                />
                <StatsCounter
                  value={configuredCount}
                  label="Active on ARIS"
                  valueClassName="dark:text-white"
                  labelClassName="text-gray-500"
                  className=""
                />
                <StatsCounter
                  value={countries.length - configuredCount}
                  label="Pending Setup"
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
                    name: rec.name,
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
