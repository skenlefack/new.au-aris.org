'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubDomains } from '@/hooks/use-sub-domains';
import type { SubDomainType } from '@/lib/stores/domain-store';

interface SubDomainsGridProps {
  domainCode: string;
}

const TYPE_BADGES: Record<SubDomainType, { label: string; classes: string }> = {
  VALUE_CHAIN: {
    label: 'Chaine de valeur',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  ORGANIZATIONAL: {
    label: 'Organisationnel',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  PATHOLOGY: {
    label: 'Pathologie',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  OTHER: {
    label: 'Autre',
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
};

/**
 * Grid of sub-domain cards for a given domain.
 * Uses useSubDomains(domainCode) from the Zustand store (RBAC-filtered).
 * Returns null if no sub-domains are available.
 */
export function SubDomainsGrid({ domainCode }: SubDomainsGridProps) {
  const subDomains = useSubDomains(domainCode);

  if (!subDomains || subDomains.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-[#1F4E79]/10 text-center text-[10px] font-bold leading-4 text-[#1F4E79]">
            S
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Sous-domaines
          </h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {subDomains.length}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {subDomains.map((sd) => {
          const typeBadge = TYPE_BADGES[sd.typeEnum] ?? TYPE_BADGES.OTHER;

          return (
            <Link
              key={sd.id}
              href={`/domains/${domainCode}/${sd.code}`}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Type accent line */}
              <div
                className={cn(
                  'absolute inset-x-0 top-0 h-0.5',
                  sd.typeEnum === 'VALUE_CHAIN'
                    ? 'bg-emerald-500'
                    : sd.typeEnum === 'ORGANIZATIONAL'
                      ? 'bg-blue-500'
                      : sd.typeEnum === 'PATHOLOGY'
                        ? 'bg-red-500'
                        : 'bg-gray-400',
                )}
              />

              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-[#1F4E79] dark:text-white">
                    {sd.labelEn || sd.labelFr}
                  </h3>
                  {sd.description && (
                    <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">
                      {sd.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1F4E79] dark:text-gray-600" />
              </div>

              <div className="mt-3 flex items-center gap-2">
                {/* Type badge */}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    typeBadge.classes,
                  )}
                >
                  {typeBadge.label}
                </span>

                {/* Value chain code badge */}
                {sd.valueChainCode && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {sd.valueChainCode}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
