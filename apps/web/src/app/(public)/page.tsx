import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { ContinentalStats } from '@/components/landing/ContinentalStats';
import { RecCard } from '@/components/landing/RecCard';
import { LoginPanel } from '@/components/landing/LoginPanel';
import { getAllRecs, type RecConfig } from '@/data/recs-config';
import { getPublicRecs } from '@/lib/api/public-data';

export const revalidate = 300; // ISR: refresh every 5 min

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
          name: ar.name?.en ?? sr.name,
          fullName: ar.fullName?.en ?? sr.fullName,
          description: ar.description?.en ?? sr.description,
          region: ar.region?.en ?? sr.region,
          headquarters: ar.headquarters ?? sr.headquarters,
          memberCount: ar._count?.countries ?? sr.memberCount,
          color: ar.accentColor ?? sr.color,
        };
      });
    }
  } catch {
    // Static fallback already assigned
  }

  return (
    <>
      <LandingHeader />
      <HeroSection />
      <ContinentalStats />

      {/* Main content: RECs grid + Login sidebar */}
      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row">
          {/* Left: RECs */}
          <div className="flex-1">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Regional Economic Communities
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select a REC to explore its member states and regional data
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {recs.map((rec) => (
                <RecCard key={rec.code} rec={rec} />
              ))}
            </div>
          </div>

          {/* Right: Login Panel (sticky sidebar) */}
          <div className="lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <div id="login-panel" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <LoginPanel
                  context={{
                    level: 'continental',
                    name: 'ARIS Continental',
                  }}
                />
              </div>

              {/* Quick links under login */}
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Quick Access
                </h4>
                <div className="space-y-2 text-sm">
                  <QuickLink label="Outbreak Map" desc="Real-time surveillance" color="#C62828" />
                  <QuickLink label="Data Quality" desc="Continental scoring" color="#F57F17" />
                  <QuickLink label="Knowledge Portal" desc="E-learning & resources" color="#1B5E20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function QuickLink({ label, desc, color }: { label: string; desc: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white dark:hover:bg-gray-700">
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
