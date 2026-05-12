import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { ContinentalStats } from '@/components/landing/ContinentalStats';
import { ContinentalContent } from '@/components/landing/ContinentalContent';
import { getAllRecs, type RecConfig } from '@/data/recs-config';
import { getPublicRecs, getPublicDomains } from '@/lib/api/public-data';

export const dynamic = 'force-dynamic'; // Always fetch from API at request time

export default async function ContinentalPage() {
  const staticRecs = getAllRecs();

  // Fetch REC data from database — static config only for UI-only fields (colorLight, colorDark)
  let recs: RecConfig[] = staticRecs;
  try {
    const apiRes = await getPublicRecs();
    const apiRecs: any[] = apiRes?.data ?? [];
    if (apiRecs.length > 0 && !apiRecs[0]?._static) {
      recs = apiRecs.map((ar) => {
        const sr = staticRecs.find((s) => s.code === ar.code);
        return {
          code: ar.code,
          // UI-only fields from static config
          colorLight: sr?.colorLight ?? '#f0f0f0',
          colorDark: sr?.colorDark ?? '#333333',
          countryCodes: sr?.countryCodes ?? [],
          tenantId: sr?.tenantId ?? '',
          // All content from database
          name: ar.name?.en ?? ar.code,
          nameFr: ar.name?.fr ?? '',
          namePt: ar.name?.pt ?? '',
          fullName: ar.fullName?.en ?? '',
          fullNameFr: ar.fullName?.fr ?? '',
          fullNamePt: ar.fullName?.pt ?? '',
          description: ar.description?.en ?? '',
          descriptionFr: ar.description?.fr ?? '',
          descriptionPt: ar.description?.pt ?? '',
          region: ar.region?.en ?? '',
          regionFr: ar.region?.fr ?? '',
          regionPt: ar.region?.pt ?? '',
          headquarters: ar.headquarters ?? '',
          establishedYear: ar.established ?? null,
          memberCount: ar._count?.countries ?? 0,
          color: ar.accentColor ?? sr?.color ?? '#666666',
        } as RecConfig;
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
