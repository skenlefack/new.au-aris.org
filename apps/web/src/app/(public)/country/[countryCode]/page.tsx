import { redirect } from 'next/navigation';
import {
  MapPin,
  Clock,
  Languages,
  Users,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LoginPanel } from '@/components/landing/LoginPanel';
import { getCountry, type CountryConfig } from '@/data/countries-config';
import { getRecsForCountry, type RecConfig } from '@/data/recs-config';
import { getHighlights, getGauges, type TrendDir, type StatusLevel } from '@/data/country-domain-stats';
import { getPublicCountryByCode } from '@/lib/api/public-data';

export const revalidate = 300;

interface Props {
  params: { countryCode: string };
}

export default async function CountryPage({ params }: Props) {
  const code = (params.countryCode as string)?.toUpperCase();
  const staticCountry = code ? getCountry(code) : undefined;
  if (!staticCountry) redirect('/');

  const staticRecs = getRecsForCountry(code);

  // Attempt live API fetch
  let country: CountryConfig = staticCountry;
  let recs: RecConfig[] = staticRecs;

  try {
    const apiRes = await getPublicCountryByCode(code);
    const apiCountry = apiRes?.data;
    if (apiCountry && !apiCountry._static) {
      country = {
        ...staticCountry,
        name: apiCountry.name?.en ?? staticCountry.name,
        capital: apiCountry.capital?.en ?? staticCountry.capital,
        flag: apiCountry.flag ?? staticCountry.flag,
        population: apiCountry.population
          ? apiCountry.population / 1_000_000
          : staticCountry.population,
        timezone: apiCountry.timezone ?? staticCountry.timezone,
        languages: apiCountry.languages ?? staticCountry.languages,
        tenantId: apiCountry.tenantId ?? staticCountry.tenantId,
      };

      // Merge REC data if API returned REC info
      const apiRecs: any[] = apiCountry.recs ?? [];
      if (apiRecs.length > 0) {
        recs = staticRecs.map((sr) => {
          const ar = apiRecs.find((r: any) => r.rec?.code === sr.code);
          if (!ar?.rec) return sr;
          return {
            ...sr,
            name: ar.rec.name?.en ?? sr.name,
            color: ar.rec.accentColor ?? sr.color,
            region: ar.rec.region?.en ?? sr.region,
          };
        });
      }
    }
  } catch {
    // Static fallback already assigned
  }

  const primaryRec = recs[0];
  const isConfigured = !!country.tenantId;
  const highlights = getHighlights(code, country.population);
  const gauges = getGauges(code, country.population);

  return (
    <>
      <LandingHeader rec={primaryRec} country={country} />

      {/* Hero with country flag */}
      <section
        className="relative overflow-hidden"
        style={{
          background: primaryRec
            ? `linear-gradient(135deg, ${primaryRec.color}, ${primaryRec.colorDark})`
            : 'linear-gradient(135deg, #006B3F, #003D24)',
        }}
      >
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#D4A843] via-[#E8C875] to-[#D4A843]" />

        {/* Large transparent flag */}
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[6rem] opacity-10 sm:right-12 sm:text-[8rem]">
          {country.flag}
        </div>

        <div className="relative mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Flag + Title */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="text-4xl sm:text-5xl">{country.flag}</span>
              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-xs text-white/90 backdrop-blur-sm">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D4A843]" />
                  Member State
                  {primaryRec && ` \u2022 ${primaryRec.name}`}
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                  {country.name}
                </h1>
                <p className="text-sm text-white/70">{country.nameFr}</p>
              </div>
            </div>

            {/* Right: Quick stats */}
            <div className="grid grid-cols-4 gap-2 lg:gap-3">
              <InfoBox icon={MapPin} label="Capital" value={country.capital} />
              <InfoBox icon={Users} label="Population" value={`${country.population >= 1 ? `${country.population}M` : `${Math.round(country.population * 1000)}K`}`} />
              <InfoBox icon={Clock} label="Timezone" value={country.timezone.split('/').pop()?.replace('_', ' ') ?? country.timezone} />
              <InfoBox icon={Languages} label="Languages" value={country.languages.slice(0, 2).join(', ')} />
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row">
          {/* Left: Country details */}
          <div className="flex-1 space-y-6">
            {/* Status card */}
            <div className={`rounded-xl border p-5 ${isConfigured ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'}`}>
              <div className="flex items-center gap-3">
                {isConfigured ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
                <div>
                  <p className={`text-sm font-semibold ${isConfigured ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {isConfigured ? 'Active on ARIS' : 'Pending Configuration'}
                  </p>
                  <p className={`text-xs ${isConfigured ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {isConfigured
                      ? 'This country is fully configured and operational on the ARIS platform.'
                      : 'This country is scheduled for onboarding. Contact your REC coordinator for setup.'}
                  </p>
                </div>
              </div>
            </div>

            {/* REC memberships */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                REC Memberships
              </h3>
              <div className="flex flex-wrap gap-2">
                {recs.map((rec) => (
                  <a
                    key={rec.code}
                    href={`/rec/${rec.code}`}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:opacity-80"
                    style={{
                      borderColor: `${rec.color}40`,
                      backgroundColor: rec.colorLight,
                      color: rec.colorDark,
                    }}
                  >
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: rec.color }} />
                    {rec.name}
                    <span className="text-xs opacity-60">{rec.region}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Headline figures (3 big cards) */}
            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((h) => (
                <div
                  key={h.domain}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${h.color}, ${h.color}80)` }} />
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
                      style={{ backgroundColor: `${h.color}14`, color: h.color }}
                    >
                      <h.icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{h.domain}</p>
                      <p className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">{h.value}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{h.subtitle}</p>
                  <div className="mt-3 flex items-center gap-1">
                    <TrendBadge dir={h.trend} value={h.trendValue} />
                    <span className="text-[10px] text-gray-400">vs last year</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Domain gauges (6 rows with progress bars) */}
            <div className="rounded-2xl border border-gray-200/60 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Sector Performance
                </h3>
                <p className="text-[11px] text-gray-400">National indicators across ARIS domains</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {gauges.map((g) => (
                  <div key={g.domain} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/20">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${g.color}14`, color: g.color }}
                    >
                      <g.icon className="h-4 w-4" strokeWidth={2} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{g.domain}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-gray-900 dark:text-white">{g.score}%</span>
                          <StatusDot status={g.status} label={g.statusLabel} />
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${g.score}%`, backgroundColor: g.color }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{g.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Login */}
          <div className="lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <LoginPanel
                  context={{
                    level: 'country',
                    name: country.name,
                    flag: country.flag,
                    color: primaryRec?.color ?? '#006B3F',
                    countryCode: country.code,
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

function InfoBox({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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

function TrendBadge({ dir, value }: { dir: TrendDir; value: string }) {
  const config = {
    up:     { icon: ArrowUpRight, bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', prefix: '+' },
    down:   { icon: ArrowDownRight, bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-500 dark:text-red-400', prefix: '-' },
    stable: { icon: Minus, bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400', prefix: '' },
  }[dir];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${config.bg} ${config.text}`}>
      <Icon className="h-3 w-3" />
      {config.prefix}{value}
    </span>
  );
}

function StatusDot({ status, label }: { status: StatusLevel; label: string }) {
  const color = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    alert: 'bg-red-500',
  }[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </span>
  );
}
