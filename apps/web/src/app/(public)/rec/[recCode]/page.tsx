import { redirect } from 'next/navigation';
import { getRec, type RecConfig } from '@/data/recs-config';
import { getCountriesByRec, type CountryConfig } from '@/data/countries-config';
import { getPublicRecByCode } from '@/lib/api/public-data';
import { RecPageContent } from '@/components/landing/RecPageContent';

export const dynamic = 'force-dynamic';

interface Props {
  params: { recCode: string };
}

export default async function RecPage({ params }: Props) {
  const recCode = (params.recCode as string)?.toLowerCase();
  const staticRec = recCode ? getRec(recCode) : undefined;
  if (!staticRec) redirect('/');

  const staticCountries = getCountriesByRec(recCode);

  // Attempt live API fetch
  let rec: RecConfig = staticRec as RecConfig;
  let countries: CountryConfig[] = staticCountries;
  let interopCount = 0;
  let activeCount = 0;

  try {
    const apiRes = await getPublicRecByCode(recCode);
    const apiRec = apiRes?.data;
    if (apiRec && !apiRec._static) {
      interopCount = apiRec.interopCount ?? 0;
      activeCount = apiRec.activeCount ?? 0;

      // Merge REC data (keep UI-specific fields from static: colorLight, colorDark, etc.)
      rec = {
        ...(staticRec as RecConfig),
        name: apiRec.name?.en ?? staticRec!.name,
        nameFr: apiRec.name?.fr ?? staticRec!.nameFr,
        namePt: apiRec.name?.pt ?? staticRec!.namePt,
        fullName: apiRec.fullName?.en ?? staticRec!.fullName,
        fullNameFr: apiRec.fullName?.fr ?? staticRec!.fullNameFr,
        fullNamePt: apiRec.fullName?.pt ?? staticRec!.fullNamePt,
        description: apiRec.description?.en ?? staticRec!.description,
        descriptionFr: apiRec.description?.fr ?? staticRec!.descriptionFr,
        descriptionPt: apiRec.description?.pt ?? staticRec!.descriptionPt,
        region: apiRec.region?.en ?? staticRec!.region,
        regionFr: apiRec.region?.fr ?? staticRec!.regionFr,
        regionPt: apiRec.region?.pt ?? staticRec!.regionPt,
        headquarters: apiRec.headquarters ?? staticRec!.headquarters,
        establishedYear: apiRec.established ?? staticRec!.establishedYear,
        memberCount: apiRec.countries?.length ?? staticRec!.memberCount,
        color: apiRec.accentColor ?? staticRec!.color,
      };

      // Merge country data if API returned countries
      const apiCountries: any[] = apiRec.countries ?? [];
      if (apiCountries.length > 0) {
        // Start with static countries merged with API data
        const merged = staticCountries.map((sc) => {
          const ac = apiCountries.find((c: any) => c.country?.code === sc.code);
          if (!ac?.country) return sc;
          return {
            ...sc,
            name: ac.country.name?.en ?? sc.name,
            nameFr: ac.country.name?.fr ?? sc.nameFr,
            namePt: ac.country.name?.pt ?? sc.namePt,
            capital: ac.country.capital?.en ?? sc.capital,
            flag: ac.country.flag ?? sc.flag,
            population: ac.country.population
              ? ac.country.population / 1_000_000
              : sc.population,
            tenantId: ac.country.tenantId ?? sc.tenantId,
          };
        });
        // Add countries from API that are NOT in the static config (dynamically added memberships)
        const staticCodes = new Set(staticCountries.map((c) => c.code));
        for (const ac of apiCountries) {
          const c = ac.country;
          if (!c?.code || staticCodes.has(c.code)) continue;
          merged.push({
            code: c.code,
            name: c.name?.en ?? c.code,
            nameFr: c.name?.fr ?? '',
            namePt: c.name?.pt ?? '',
            nameAr: c.name?.ar ?? '',
            capital: c.capital?.en ?? '',
            flag: c.flag ?? '',
            population: c.population ? c.population / 1_000_000 : 0,
            languages: c.languages ?? [],
            timezone: c.timezone ?? '',
            recs: [recCode],
            tenantId: c.tenantId ?? null,
          } as CountryConfig);
        }
        countries = merged;
      }
    }
  } catch {
    // Static fallback already assigned
  }

  return (
    <RecPageContent
      rec={rec}
      countries={countries}
      interopCount={interopCount}
      activeCount={activeCount}
    />
  );
}
