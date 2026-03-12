'use client';

import { StatsCounter } from './StatsCounter';
import { TOTAL_RECS } from '@/data/recs-config';
import { TOTAL_COUNTRIES } from '@/data/countries-config';

interface HeroSectionProps {
  domainCount?: number;
}

export function HeroSection({ domainCount }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#006B3F] via-[#005A34] to-[#003D24]">
      {/* Decorative pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <svg className="h-full w-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="hero-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1.5" fill="white" />
              <path d="M0 30 L60 30 M30 0 L30 60" stroke="white" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-pattern)" />
        </svg>
      </div>

      {/* Gold accent line */}
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#D4A843] via-[#E8C875] to-[#D4A843]" />

      <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Title */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-[#D4A843]" />
              AU-IBAR
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Animal Resources <span className="text-[#E8C875]">Information System</span>
            </h1>

            <p className="mt-2 text-sm text-white/80">Continental digital infrastructure for animal resources management, veterinary surveillance, and food safety across 55 Member States.</p>
          </div>

          {/* Right: Stats */}
          <div className="grid grid-cols-4 gap-2 lg:gap-3">
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <StatsCounter
                value={TOTAL_COUNTRIES}
                label="States"
                valueClassName="text-white text-lg"
                labelClassName="text-white/70 text-[10px]"
              />
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <StatsCounter
                value={TOTAL_RECS}
                label="RECs"
                valueClassName="text-white text-lg"
                labelClassName="text-white/70 text-[10px]"
              />
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <StatsCounter
                value={domainCount ?? 9}
                label="Domains"
                valueClassName="text-white text-lg"
                labelClassName="text-white/70 text-[10px]"
              />
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <StatsCounter
                value={24}
                suffix="/7"
                label="Monitoring"
                valueClassName="text-[#E8C875] text-lg"
                labelClassName="text-white/70 text-[10px]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
