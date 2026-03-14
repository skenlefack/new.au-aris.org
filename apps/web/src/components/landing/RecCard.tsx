'use client';

import Link from 'next/link';
import { MapPin, Users, ChevronRight, Building2 } from 'lucide-react';
import type { RecConfig } from '@/data/recs-config';
import { useTranslations } from '@/lib/i18n/translations';

interface RecCardProps {
  rec: RecConfig;
}

export function RecCard({ rec }: RecCardProps) {
  const t = useTranslations('landing');
  return (
    <Link
      href={`/rec/${rec.code}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Gradient header band */}
      <div
        className="relative flex items-center gap-4 px-5 py-4"
        style={{ background: `linear-gradient(135deg, ${rec.color}, ${rec.colorDark})` }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
        <div className="pointer-events-none absolute -bottom-3 right-10 h-12 w-12 rounded-full opacity-[0.07]" style={{ backgroundColor: 'white' }} />

        {/* Badge */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg font-extrabold text-white shadow-sm backdrop-blur-sm">
          {rec.name.slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-white">{rec.name}</h3>
          <p className="truncate text-xs text-white/70">{rec.fullName}</p>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white/80" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 py-4">
        {/* Stats row */}
        <div className="flex items-center gap-5 text-sm">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${rec.color}12` }}
            >
              <Users className="h-4 w-4" style={{ color: rec.color }} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('members')}</p>
              <p className="font-bold text-gray-900 dark:text-white">{rec.memberCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${rec.color}12` }}
            >
              <MapPin className="h-4 w-4" style={{ color: rec.color }} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('region')}</p>
              <p className="font-bold text-gray-900 dark:text-white">{rec.region}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {rec.description}
        </p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
            style={{
              backgroundColor: rec.colorLight,
              color: rec.colorDark,
            }}
          >
            <Building2 className="h-3 w-3" />
            {rec.headquarters}
          </span>
          <span
            className="text-xs font-semibold transition-colors duration-300 group-hover:underline"
            style={{ color: rec.color }}
          >
            {t('explore')} &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
