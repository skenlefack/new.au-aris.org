'use client';

import {
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  HeartPulse,
  Wheat,
  Fish,
  TreePine,
  Bug,
  Cloud,
  Building2,
  TrendingUp,
  BookOpen,
  Syringe,
  Shield,
  Activity,
  Info,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { LandingHeader } from './LandingHeader';
import { LoginPanel } from './LoginPanel';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { getLocalizedField } from '@/lib/i18n/localize';
import { getMinistry } from '@/data/countries-config';
import type { CountryConfig } from '@/data/countries-config';
import type { RecConfig } from '@/data/recs-config';
import type { TrendDir, StatusLevel } from '@/data/country-domain-stats';

const ICON_MAP: Record<string, LucideIcon> = {
  HeartPulse, Wheat, Fish, TreePine, Bug, Cloud, Building2, TrendingUp,
  BookOpen, Syringe, Shield, Activity, BarChart3, MapPin, Users, CheckCircle2,
};

interface CountryPageContentProps {
  country: CountryConfig;
  recs: RecConfig[];
  primaryRec: RecConfig | undefined;
  isConfigured: boolean;
  isActive: boolean;
  hasInterop: boolean;
  showRealSections: boolean;
  apiStatistics: any[];
  apiKpiScores: any[];
  highlights: any[];
  gauges: any[];
  welcomeMessage: string | null;
}

export function CountryPageContent({
  country,
  recs,
  primaryRec,
  isConfigured,
  showRealSections,
  apiStatistics,
  apiKpiScores,
  highlights,
  gauges,
  welcomeMessage,
}: CountryPageContentProps) {
  const t = useTranslations('landing');
  const locale = useLocaleStore((s) => s.locale);

  const countryName = getLocalizedField(country, 'name', locale);
  const ministry = getMinistry(country.code, locale);

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
                  {t('memberStateBadge')}
                  {primaryRec && ` \u2022 ${getLocalizedField(primaryRec, 'name', locale)}`}
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                  {countryName}
                </h1>
                <p className="text-sm text-white/70">{ministry}</p>
              </div>
            </div>

            {/* Right: Quick stats */}
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <InfoBox icon={MapPin} label={t('capital')} value={country.capital} />
              <InfoBox icon={Users} label={t('populationLabel')} value={`${country.population >= 1 ? `${country.population}M` : `${Math.round(country.population * 1000)}K`}`} />
              <InfoBox icon={Clock} label={t('timezone')} value={formatTimezone(country.timezone)} />
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row">
          {/* Left: Country details */}
          <div className="flex-1 space-y-6">
            {/* Status card — only show when active */}
            {isConfigured && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t('activeOnArisTitle')}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {t('activeOnArisDesc')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* REC memberships */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                {t('recMemberships')}
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
                    {getLocalizedField(rec, 'name', locale)}
                    <span className="text-xs opacity-60">{getLocalizedField(rec, 'region', locale)}</span>
                  </a>
                ))}
              </div>
            </div>

            {showRealSections ? (
              <>
                {/* Country Statistics — real data or illustrative fallback */}
                {apiStatistics.length > 0 ? (
                  <StatisticsSection statistics={apiStatistics} locale={locale} />
                ) : (
                  <div className="space-y-2">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {highlights.map((h: any) => (
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
                            <span className="text-[10px] text-gray-400">{t('vsLastYear')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <IllustrativeDisclaimer label={t('illustrativeData')} />
                  </div>
                )}

                {/* Performance — real KPI scores or illustrative fallback */}
                {apiKpiScores.length > 0 ? (
                  <PerformanceSection kpiScores={apiKpiScores} locale={locale} t={t} />
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-gray-200/60 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                      <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          {t('sectorPerformance')}
                        </h3>
                        <p className="text-[11px] text-gray-400">{t('nationalIndicators')}</p>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {gauges.map((g: any) => (
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
                    <IllustrativeDisclaimer label={t('illustrativeData')} />
                  </div>
                )}
              </>
            ) : (
              <FallbackMessage countryName={countryName} welcomeMessage={welcomeMessage} t={t} />
            )}
          </div>

          {/* Right: Login */}
          <div className="lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <LoginPanel
                  context={{
                    level: 'country',
                    name: countryName,
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

function StatisticsSection({ statistics, locale }: { statistics: any[]; locale: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {statistics.map((s: any) => {
        const Icon = ICON_MAP[s.icon] ?? BarChart3;
        const color = s.color ?? '#6B7280';
        const formatted = formatStatValue(s.value, s.unit, s.format, locale);
        return (
          <div
            key={s.code}
            className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
                style={{ backgroundColor: `${color}14`, color }}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  {s.name?.[locale] ?? s.name?.en ?? s.code}
                </p>
                <p className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                  {formatted}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {s.domain ? `${s.domain}` : ''}{s.period ? ` \u2022 ${s.period.replace(/_/g, ' ')}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceSection({ kpiScores, locale, t }: { kpiScores: any[]; locale: string; t: (key: string, params?: Record<string, string>) => string }) {
  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          {t('performanceIndicators')}
        </h3>
        <p className="text-[11px] text-gray-400">{t('nationalKpiScores')}</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {kpiScores.map((k: any) => {
          const Icon = ICON_MAP[k.icon] ?? Activity;
          const color = k.color ?? '#6B7280';
          const score = Math.round(k.score ?? 0);
          const status: StatusLevel = k.status ?? (score >= 75 ? 'good' : score >= 50 ? 'warning' : 'alert');
          const statusLabel = k.statusLabel ?? (score >= 75 ? t('good') : score >= 50 ? t('moderate') : t('low'));
          return (
            <div key={k.code} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/20">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}14`, color }}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {k.name?.[locale] ?? k.name?.en ?? k.code}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-gray-900 dark:text-white">{score}%</span>
                    <StatusDot status={status} label={statusLabel} />
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${score}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FallbackMessage({ countryName, welcomeMessage, t }: { countryName: string; welcomeMessage: string | null; t: (key: string, params?: Record<string, string>) => string }) {
  const currentYear = new Date().getFullYear();

  const defaultHtml = `
    <p>${t('defaultWelcomeP1', { country: countryName })}</p>
    <p>${t('defaultWelcomeP2')}</p>
    <p>${t('defaultWelcomeP3')}</p>
    <p>${t('defaultWelcomeP4')}
    <a href="mailto:aris@au-ibar.org">aris@au-ibar.org</a>.</p>
  `;

  const htmlContent = welcomeMessage || defaultHtml;

  return (
    <div className="space-y-4">
      {/* Welcome content */}
      <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aris-primary-50 dark:bg-aris-primary-900/30">
            <Info className="h-5 w-5 text-aris-primary-600 dark:text-aris-primary-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('welcomeTo', { country: countryName })}
          </h3>
        </div>
        <div
          className="prose prose-sm max-w-none text-gray-600 prose-a:text-aris-primary-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg dark:text-gray-300 dark:prose-a:text-aris-primary-400"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Red status banner */}
      <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-r from-red-600 via-red-700 to-red-800 shadow-lg dark:border-red-900">
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <Info className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {t('notYetActiveYear', { year: String(currentYear) })}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-red-100">
                {t('notYetActiveDesc', { country: countryName, year: String(currentYear) })}
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-red-400 via-amber-400 to-red-400" />
      </div>
    </div>
  );
}

function IllustrativeDisclaimer({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
      <Info className="h-3 w-3" />
      {label}
    </p>
  );
}

function formatStatValue(value: number | null | undefined, unit?: string, format?: string, locale?: string): string {
  if (value == null) return '\u2014';
  const loc = locale === 'fr' ? 'fr-FR' : locale === 'pt' ? 'pt-PT' : 'en';
  if (format === 'compact') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  }
  if (format === 'currency') return value.toLocaleString(loc, { maximumFractionDigits: 0 });
  if (unit === 'percentage') return `${Math.round(value)}%`;
  return value.toLocaleString(loc, { maximumFractionDigits: 1 });
}

/** Format IANA timezone to "City (GMT+X)" */
function formatTimezone(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    return `${city} (${offset})`;
  } catch {
    return city;
  }
}
