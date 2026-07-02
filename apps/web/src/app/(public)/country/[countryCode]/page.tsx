import { redirect } from 'next/navigation';
import { getCountry, type CountryConfig } from '@/data/countries-config';
import { getRecsForCountry, type RecConfig } from '@/data/recs-config';
import { getHighlights, getGauges } from '@/data/country-domain-stats';
import { getPublicCountryByCode, getPublicDomains } from '@/lib/api/public-data';
import { CountryPageContent } from '@/components/landing/CountryPageContent';

export const dynamic = 'force-dynamic';

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
  let apiStatistics: any[] = [];
  let apiKpiScores: any[] = [];
  let isActive = false;
  let hasInterop = false;
  let welcomeMessage: string | null = null;

  try {
    const apiRes = await getPublicCountryByCode(code);
    const apiCountry = apiRes?.data;
    if (apiCountry && !apiCountry._static) {
      country = {
        ...staticCountry,
        name: apiCountry.name?.en ?? staticCountry.name,
        nameFr: apiCountry.name?.fr ?? staticCountry.nameFr,
        namePt: apiCountry.name?.pt ?? staticCountry.namePt,
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
            nameFr: ar.rec.name?.fr ?? sr.nameFr,
            namePt: ar.rec.name?.pt ?? sr.namePt,
            color: ar.rec.accentColor ?? sr.color,
            region: ar.rec.region?.en ?? sr.region,
            regionFr: ar.rec.region?.fr ?? sr.regionFr,
            regionPt: ar.rec.region?.pt ?? sr.regionPt,
          };
        });
      }

      apiStatistics = apiCountry.statistics ?? [];
      apiKpiScores = apiCountry.kpiScores ?? [];
      isActive = apiCountry.isActive ?? false;
      hasInterop = apiCountry.hasInterop ?? false;
      welcomeMessage = apiCountry.welcomeMessage ?? null;
    }
  } catch {
    // Static fallback already assigned
  }

  const primaryRec = recs[0];
  // A country is "configured" only if it's truly active (has admin + users + data)
  const isConfigured = isActive;
  const showRealSections = isActive || hasInterop;

  // Fetch active domain codes to filter illustrative stats
  let activeDomainCodes: Set<string> | null = null;
  try {
    const domainsRes = await getPublicDomains();
    const apiDomains: any[] = domainsRes?.data ?? [];
    if (apiDomains.length > 0) {
      activeDomainCodes = new Set(apiDomains.map((d) => d.code));
    }
  } catch {
    // If API fails, show all (no filtering)
  }

  const allHighlights = getHighlights(code, country.population);
  const allGauges = getGauges(code, country.population);
  const highlights = activeDomainCodes
    ? allHighlights.filter((h) => !h.domainCode || activeDomainCodes!.has(h.domainCode))
    : allHighlights;
  const gauges = activeDomainCodes
    ? allGauges.filter((g) => !g.domainCode || activeDomainCodes!.has(g.domainCode))
    : allGauges;

  return (
    <CountryPageContent
      country={country}
      recs={recs}
      primaryRec={primaryRec}
      isConfigured={isConfigured}
      isActive={isActive}
      hasInterop={hasInterop}
      showRealSections={showRealSections}
      apiStatistics={apiStatistics}
      apiKpiScores={apiKpiScores}
      highlights={highlights}
      gauges={gauges}
      welcomeMessage={welcomeMessage}
    />
  );
}
