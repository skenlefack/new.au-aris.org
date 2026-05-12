import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { ContinentalStats } from '@/components/landing/ContinentalStats';
import { ContinentalContent } from '@/components/landing/ContinentalContent';
import { getAllRecs, type RecConfig } from '@/data/recs-config';
import { getPublicRecs, getPublicDomains } from '@/lib/api/public-data';

export const dynamic = 'force-dynamic'; // Always fetch from API at request time

export default async function ContinentalPage() {
  const staticRecs = getAllRecs();

  // Attempt live API fetch (falls back to static data inside getPublicRecs)
  let recs: RecConfig[] = staticRecs;
  try {
    const apiRes = await getPublicRecs();
    const apiRecs: any[] = apiRes?.data ?? [];
    if (apiRecs.length > 0 && !apiRecs[0]?._static) {
      // Merge API data with static config for UI-specific fields (colorLight, colorDark, etc.)
      recs = staticRecs.map((sr) => {
        const ar = apiRecs.find((r: any) => r.code === sr.code);
        if (!ar) return sr;
        return {
          ...sr,
          name: ar.name?.en || sr.name,
          nameFr: ar.name?.fr || sr.nameFr,
          namePt: ar.name?.pt || sr.namePt,
          fullName: ar.fullName?.en || sr.fullName,
          fullNameFr: ar.fullName?.fr || sr.fullNameFr,
          fullNamePt: ar.fullName?.pt || sr.fullNamePt,
          description: ar.description?.en || sr.description,
          descriptionFr: ar.description?.fr || sr.descriptionFr,
          descriptionPt: ar.description?.pt || sr.descriptionPt,
          region: ar.region?.en || sr.region,
          regionFr: ar.region?.fr || sr.regionFr,
          regionPt: ar.region?.pt || sr.regionPt,
          headquarters: ar.headquarters || sr.headquarters,
          establishedYear: ar.established ?? sr.establishedYear,
          memberCount: ar._count?.countries ?? sr.memberCount,
          color: ar.accentColor || sr.color,
        };
      });
    }
  } catch {
    // Static fallback already assigned
  }

  // Fetch public domains for ContinentalStats + HeroSection counter
  let domains: any[] = [];
  try {
    const domainRes = await getPublicDomains();
    domains = domainRes?.data ?? [];
  } catch {
    // Fallback handled inside ContinentalStats
  }

  return (
    <>
      <LandingHeader />
      <HeroSection domainCount={domains.length > 0 ? domains.length : undefined} />
      <ContinentalStats domains={domains.length > 0 ? domains : undefined} />
      <ContinentalContent recs={recs} />
    </>
  );
}
