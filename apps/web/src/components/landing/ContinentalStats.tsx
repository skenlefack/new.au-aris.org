'use client';

import {
  Bug,
  Syringe,
  ClipboardCheck,
  Globe2,
  TrendingUp,
  Leaf,
  Fish,
  Wheat,
  ShieldCheck,
} from 'lucide-react';

const DOMAINS = [
  { icon: Bug, label: 'Animal Health', color: '#C62828', desc: 'Surveillance, outbreaks, AMR' },
  { icon: Syringe, label: 'Vaccination', color: '#1565C0', desc: 'Campaigns & coverage' },
  { icon: Wheat, label: 'Livestock', color: '#E65100', desc: 'Census & production' },
  { icon: Fish, label: 'Fisheries', color: '#00838F', desc: 'Captures & aquaculture' },
  { icon: Leaf, label: 'Wildlife', color: '#2E7D32', desc: 'Biodiversity & CITES' },
  { icon: Globe2, label: 'Trade & SPS', color: '#6A1B9A', desc: 'Markets & certification' },
  { icon: ShieldCheck, label: 'Governance', color: '#37474F', desc: 'Legal frameworks & PVS' },
  { icon: ClipboardCheck, label: 'Data Quality', color: '#F57F17', desc: 'Validation & scoring' },
  { icon: TrendingUp, label: 'Analytics', color: '#1B5E20', desc: 'KPIs & dashboards' },
];

export function ContinentalStats() {
  return (
    <section className="border-t border-gray-100 bg-gray-50 py-6 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {DOMAINS.map((d) => (
            <div
              key={d.label}
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
                <d.icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <p className="mt-2.5 text-xs font-bold text-gray-800 dark:text-white">
                {d.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
                {d.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
