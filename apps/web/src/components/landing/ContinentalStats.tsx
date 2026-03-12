'use client';

import { resolveIcon } from '@/lib/lucide-icon-map';
import { Layers } from 'lucide-react';

export interface PublicDomain {
  code: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  icon: string;
  color: string;
}

/** Fallback domains when the API is unavailable */
const FALLBACK_DOMAINS: PublicDomain[] = [
  { code: 'animal-health', name: { en: 'Animal Health' }, icon: 'HeartPulse', color: '#C62828', description: { en: 'Surveillance, outbreaks, AMR' } },
  { code: 'livestock-prod', name: { en: 'Livestock' }, icon: 'Wheat', color: '#E65100', description: { en: 'Census & production' } },
  { code: 'fisheries', name: { en: 'Fisheries' }, icon: 'Fish', color: '#00838F', description: { en: 'Captures & aquaculture' } },
  { code: 'trade-sps', name: { en: 'Trade & SPS' }, icon: 'TrendingUp', color: '#1565C0', description: { en: 'Markets & certification' } },
  { code: 'wildlife', name: { en: 'Wildlife' }, icon: 'Leaf', color: '#2E7D32', description: { en: 'Biodiversity & CITES' } },
  { code: 'apiculture', name: { en: 'Apiculture' }, icon: 'Bug', color: '#F9A825', description: { en: 'Pollination & honey' } },
  { code: 'governance', name: { en: 'Governance' }, icon: 'Landmark', color: '#37474F', description: { en: 'Legal frameworks & PVS' } },
  { code: 'climate-env', name: { en: 'Climate & Env' }, icon: 'CloudSun', color: '#00695C', description: { en: 'Water stress & rangelands' } },
  { code: 'knowledge-hub', name: { en: 'Knowledge' }, icon: 'BookOpen', color: '#4527A0', description: { en: 'E-learning & resources' } },
];

interface ContinentalStatsProps {
  domains?: PublicDomain[];
}

export function ContinentalStats({ domains }: ContinentalStatsProps) {
  const list = domains && domains.length > 0 ? domains : FALLBACK_DOMAINS;

  // Responsive: max 9 cols on large screens, adapt to actual count
  const colClass =
    list.length <= 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : list.length <= 6
        ? 'grid-cols-3 sm:grid-cols-6'
        : list.length <= 9
          ? 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9'
          : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9';

  return (
    <section className="border-t border-gray-100 bg-gray-50 py-6 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className={`grid gap-3 ${colClass}`}>
          {list.map((d) => {
            const Icon = resolveIcon(d.icon);
            const label = d.name?.en ?? d.code;
            const desc = d.description?.en ?? '';
            return (
              <div
                key={d.code}
                className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-gray-200/80 bg-white px-3 py-4 text-center shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ backgroundColor: d.color }}
                />
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-110 group-hover:shadow-md"
                  style={{ backgroundColor: `${d.color}12`, color: d.color }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <p className="mt-2.5 text-xs font-bold text-gray-800 dark:text-white">
                  {label}
                </p>
                {desc && (
                  <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
                    {desc}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
