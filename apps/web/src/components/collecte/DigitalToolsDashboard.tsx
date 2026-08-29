'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Globe2,
  Monitor,
  MonitorOff,
  ClipboardCheck,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignSubmissions } from '@/lib/api/workflow-hooks';
import { AFRICA_COUNTRIES } from '@/components/dashboard/maps/africa-geo-data';
import { useTranslations } from 'next-intl';

/* Custom map — dynamic import (no SSR, Leaflet needs window) */
const DigitalToolsMap = dynamic(
  () => import('./DigitalToolsMap'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/* ── Country name → ISO2 mapping ── */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {};
for (const c of AFRICA_COUNTRIES) {
  COUNTRY_NAME_TO_ISO2[c.name.toLowerCase()] = c.code;
  COUNTRY_NAME_TO_ISO2[c.nameFr.toLowerCase()] = c.code;
}
const EXTRA: Record<string, string> = {
  'ivory coast': 'CI', "cote d'ivoire": 'CI', 'democratic republic of the congo': 'CD',
  'dr congo': 'CD', 'drc': 'CD', 'republic of the congo': 'CG', 'congo brazzaville': 'CG',
  'south africa': 'ZA', 'south sudan': 'SS', 'burkina': 'BF', 'tanzania': 'TZ',
  'united republic of tanzania': 'TZ', 'central african republic': 'CF',
  'equatorial guinea': 'GQ', 'guinea-bissau': 'GW', 'guinea bissau': 'GW',
  'sierra leone': 'SL', 'cabo verde': 'CV', 'cape verde': 'CV',
  'sao tome and principe': 'ST', 'são tomé': 'ST', 'sao tome': 'ST',
  'eswatini': 'SZ', 'swaziland': 'SZ', 'mauritius': 'MU',
  'seychelles': 'SC', 'comoros': 'KM', 'lesotho': 'LS',
  'kenya': 'KE', 'ethiopia': 'ET', 'nigeria': 'NG', 'senegal': 'SN',
  'ghana': 'GH', 'cameroon': 'CM', 'cameroun': 'CM', 'chad': 'TD', 'tchad': 'TD',
  'niger': 'NE', 'mali': 'ML', 'benin': 'BJ', 'bénin': 'BJ', 'togo': 'TG',
  'uganda': 'UG', 'ouganda': 'UG', 'rwanda': 'RW', 'burundi': 'BI',
  'mozambique': 'MZ', 'zambia': 'ZM', 'zambie': 'ZM', 'zimbabwe': 'ZW',
  'malawi': 'MW', 'madagascar': 'MG', 'angola': 'AO', 'namibia': 'NA', 'namibie': 'NA',
  'botswana': 'BW', 'gabon': 'GA', 'congo': 'CG', 'liberia': 'LR', 'libéria': 'LR',
  'gambia': 'GM', 'gambie': 'GM', 'mauritania': 'MR', 'mauritanie': 'MR',
  'morocco': 'MA', 'maroc': 'MA', 'algeria': 'DZ', 'algérie': 'DZ',
  'tunisia': 'TN', 'tunisie': 'TN', 'libya': 'LY', 'libye': 'LY',
  'egypt': 'EG', 'égypte': 'EG', 'sudan': 'SD', 'soudan': 'SD',
  'somalia': 'SO', 'somalie': 'SO', 'djibouti': 'DJ', 'eritrea': 'ER', 'érythrée': 'ER',
};
Object.assign(COUNTRY_NAME_TO_ISO2, EXTRA);

function resolveCountryCode(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-zà-ÿ\s'-]/g, '');
  if (cleaned.length === 2) {
    const upper = cleaned.toUpperCase();
    if (AFRICA_COUNTRIES.some((c) => c.code === upper)) return upper;
  }
  return COUNTRY_NAME_TO_ISO2[cleaned] ?? null;
}

type DigitalStatus = 'uses_digital' | 'no_digital' | 'not_surveyed';

interface CountryDigitalInfo {
  code: string;
  name: string;
  status: DigitalStatus;
  toolName?: string;
  toolDeveloper?: string;
  hasSurveillance?: boolean;
  institution?: string;
}

/* ── Pie chart ── */
function PieChart({ entries, colors, size = 160 }: {
  entries: { label: string; value: number }[];
  colors: string[];
  size?: number;
}) {
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  let acc = 0;
  const stops = entries.map((e, i) => {
    const start = (acc / total) * 360;
    acc += e.value;
    const end = (acc / total) * 360;
    return `${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0 rounded-full shadow-lg"
        style={{ width: size, height: size, background: entries.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb' }} />
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={e.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {e.label}: <strong>{e.value}</strong>
              <span className="ml-1 text-xs text-gray-400">({Math.round((e.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut chart ── */
function DonutChart({ entries, colors, size = 160, centerLabel }: {
  entries: { label: string; value: number }[];
  colors: string[];
  size?: number;
  centerLabel?: string;
}) {
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  let acc = 0;
  const stops = entries.map((e, i) => {
    const start = (acc / total) * 360;
    acc += e.value;
    const end = (acc / total) * 360;
    return `${colors[i % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0 rounded-full shadow-lg"
        style={{ width: size, height: size, background: entries.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb' }}>
        <div className="absolute rounded-full bg-white dark:bg-gray-900 flex items-center justify-center" style={{ inset: size * 0.2 }}>
          {centerLabel && <span className="text-lg font-bold text-gray-700 dark:text-gray-200">{centerLabel}</span>}
        </div>
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={e.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {e.label}: <strong>{e.value}</strong>
              <span className="ml-1 text-xs text-gray-400">({Math.round((e.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  DigitalToolsDashboard                                              */
/* ================================================================== */

export default function DigitalToolsDashboard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslations('collecte');
  const sQ = useCampaignSubmissions(campaignId, { limit: 100 });
  const rawSubs: any[] = Array.isArray(sQ.data?.data) ? sQ.data.data : [];
  const loading = sQ.isLoading;
  const error = sQ.error as Error | null;

  const { countriesInfo, kpis, mapData, toolsByDeveloper } = useMemo(() => {
    const byCountry = new Map<string, CountryDigitalInfo>();
    for (const sub of rawSubs) {
      const d = sub.data || {};
      const rawCountry = d.country || '';
      const code = resolveCountryCode(rawCountry);
      if (!code) continue;
      const countryGeo = AFRICA_COUNTRIES.find((c) => c.code === code);
      if (!countryGeo) continue;
      const usesDigital = d.uses_digital_tool === 'yes';
      byCountry.set(code, {
        code, name: countryGeo.nameFr || countryGeo.name,
        status: usesDigital ? 'uses_digital' : 'no_digital',
        toolName: d.tool_name || undefined, toolDeveloper: d.tool_developer || undefined,
        hasSurveillance: d.has_surveillance === 'yes', institution: d.institution || undefined,
      });
    }
    const all = Array.from(byCountry.values());
    const surveyed = all.length;
    const withDigital = all.filter((c) => c.status === 'uses_digital').length;
    const withOwnSystem = all.filter((c) => c.toolName).length;
    const withoutDigital = all.filter((c) => c.status === 'no_digital').length;
    const withSurveillance = all.filter((c) => c.hasSurveillance).length;

    const devMap = new Map<string, number>();
    for (const c of all) {
      if (c.toolDeveloper) devMap.set(c.toolDeveloper, (devMap.get(c.toolDeveloper) || 0) + 1);
    }
    const devArr = Array.from(devMap.entries()).map(([dev, count]) => ({ label: dev, value: count })).sort((a, b) => b.value - a.value);

    return {
      countriesInfo: all,
      kpis: { surveyed, withDigital, withOwnSystem, withoutDigital, withSurveillance },
      toolsByDeveloper: devArr,
    };
  }, [rawSubs]);

  const digitalCountries = useMemo(() => countriesInfo.filter((c) => c.status === 'uses_digital').sort((a, b) => a.name.localeCompare(b.name)), [countriesInfo]);
  const noDigitalCountries = useMemo(() => countriesInfo.filter((c) => c.status === 'no_digital').sort((a, b) => a.name.localeCompare(b.name)), [countriesInfo]);

  const allCountriesStatus = useMemo(() => {
    const statusMap = new Map<string, DigitalStatus>();
    for (const c of countriesInfo) statusMap.set(c.code, c.status);
    return AFRICA_COUNTRIES.map((c) => ({ ...c, status: statusMap.get(c.code) ?? ('not_surveyed' as DigitalStatus) }));
  }, [countriesInfo]);

  const statusColors: Record<DigitalStatus, string> = { uses_digital: '#059669', no_digital: '#DC2626', not_surveyed: '#D1D5DB' };
  const statusLabels: Record<DigitalStatus, string> = { uses_digital: t('usesDigitalTool'), no_digital: t('noDigitalTool'), not_surveyed: t('notSurveyed') };

  // Error state
  if (error && rawSubs.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed to load survey data</p>
        <p className="mt-1 text-xs text-red-500">{error.message}</p>
        <p className="mt-2 text-xs text-gray-500">Campaign: {campaignId}</p>
        <button onClick={() => sQ.refetch()} className="mt-2 text-xs text-blue-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-950">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-[#1E40AF] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-white/80" />
          <span className="text-sm font-bold tracking-wide text-white">
            {t('pprDigitalToolsTitle')}
          </span>
        </div>
        <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
          {kpis.surveyed} {t('countriesSurveyed')}
        </span>
      </div>

      {/* 5 KPI ROW */}
      <div className="grid grid-cols-5 divide-x divide-gray-200 border-b border-gray-300 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        ) : (
          [
            { icon: ClipboardCheck, val: kpis.surveyed, label: t('countriesSurveyed'), color: '#1E40AF', bg: '#EFF6FF' },
            { icon: Monitor, val: kpis.withDigital, label: t('useDigitalTools'), color: '#059669', bg: '#ECFDF5' },
            { icon: Server, val: kpis.withOwnSystem, label: t('haveOwnSystem'), color: '#7C3AED', bg: '#F5F3FF' },
            { icon: MonitorOff, val: kpis.withoutDigital, label: t('noDigitalSystem'), color: '#DC2626', bg: '#FEF2F2' },
            { icon: ShieldCheck, val: kpis.withSurveillance, label: t('withSurveillanceSystem'), color: '#EA580C', bg: '#FFF7ED' },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: k.bg }}>
                  <Icon className="h-5 w-5" style={{ color: k.color }} />
                </div>
                <div>
                  <p className="text-2xl font-black" style={{ color: k.color }}>{k.val}</p>
                  <p className="text-[10px] leading-tight text-gray-500">{k.label}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="min-h-[300px] rounded-xl" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* ROW 1: Map + Charts */}
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Africa Map — spans 3, stretches to match right column height */}
            <div className="lg:col-span-3 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 min-h-[580px]">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <Globe2 className="h-4 w-4 text-[#1E40AF]" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('digitalToolsMap')}</h3>
              </div>
              <div className="relative flex-1 min-h-[500px]">
                <DigitalToolsMap countries={allCountriesStatus} statusColors={statusColors} statusLabels={statusLabels} />
              </div>
            </div>

            {/* Right — 3 charts */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('digitalToolsAdoption')}</h3>
                <PieChart entries={[{ label: t('usesDigitalTool'), value: kpis.withDigital }, { label: t('noDigitalTool'), value: kpis.withoutDigital }]} colors={['#059669', '#DC2626']} size={140} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('surveillanceCoverage')}</h3>
                <DonutChart entries={[{ label: t('withSurveillanceSystem'), value: kpis.withSurveillance }, { label: t('noSurveillanceSystem'), value: kpis.surveyed - kpis.withSurveillance }]}
                  colors={['#1E40AF', '#F59E0B']} size={140} centerLabel={`${Math.round((kpis.withSurveillance / (kpis.surveyed || 1)) * 100)}%`} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('digitalSystemType')}</h3>
                <DonutChart entries={[{ label: t('haveOwnSystem'), value: kpis.withOwnSystem }, { label: t('noDigitalSystem'), value: kpis.surveyed - kpis.withOwnSystem }]}
                  colors={['#7C3AED', '#9CA3AF']} size={140} centerLabel={`${kpis.withOwnSystem}`} />
              </div>
            </div>
          </div>

          {/* ROW 2: Tables */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* WITH digital tools */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <Monitor className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('countriesUsingDigitalTools')} ({digitalCountries.length})</h3>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">{t('countries')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('tool')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('developer')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {digitalCountries.map((c) => (
                      <tr key={c.code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />{c.name}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.toolName || '—'}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.toolDeveloper || '—'}</td>
                      </tr>
                    ))}
                    {digitalCountries.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">{t('noData')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* WITHOUT digital tools */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <MonitorOff className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('countriesNoDigitalSystem')} ({noDigitalCountries.length})</h3>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2 text-left font-semibold">{t('countries')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('institution')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('surveillanceCoverage')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {noDigitalCountries.map((c) => (
                      <tr key={c.code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />{c.name}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.institution || '—'}</td>
                        <td className="px-4 py-2">
                          {c.hasSurveillance
                            ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">{t('yes')}</span>
                            : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{t('no')}</span>}
                        </td>
                      </tr>
                    ))}
                    {noDigitalCountries.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">{t('noData')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ROW 3: Developer chart + Non-surveyed */}
          <div className="grid gap-4 lg:grid-cols-2">
            {toolsByDeveloper.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">{t('toolsByDeveloper')}</h3>
                <PieChart entries={toolsByDeveloper} colors={['#1E40AF', '#059669', '#EA580C', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#4F46E5']} size={140} />
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">
                {t('countriesNotSurveyed')} ({allCountriesStatus.filter((c) => c.status === 'not_surveyed').length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {allCountriesStatus.filter((c) => c.status === 'not_surveyed').sort((a, b) => a.nameFr.localeCompare(b.nameFr)).map((c) => (
                  <span key={c.code} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    {c.nameFr}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="bg-[#1E40AF] px-4 py-1.5 text-[9px] leading-snug text-white/90">
        <strong>Source :</strong> {t('pprDigitalToolsTitle')} — AU-IBAR. {t('dataSourceFooter', { count: kpis.surveyed })}
      </div>
    </div>
  );
}
