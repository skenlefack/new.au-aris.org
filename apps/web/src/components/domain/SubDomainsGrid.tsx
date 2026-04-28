'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, ClipboardList, Database, Layers, GitBranch, Bug, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SubDomainType } from '@/lib/stores/domain-store';
import { ICON_MAP } from '@/components/ui/IconPicker';
import { useSubDomains } from '@/hooks/use-sub-domains';
import { useQuery } from '@tanstack/react-query';
import { collecteClient } from '@/lib/api/client';

interface SubDomainsGridProps {
  domainCode: string;
}

/** Fetch lightweight stats for all sub-domains of a domain in one call */
function useSubDomainStats(domainCode: string) {
  return useQuery<Record<string, { campaigns: number; forms: number; submissions: number }>>({
    queryKey: ['sub-domain-stats', domainCode],
    queryFn: async () => {
      // Fetch campaigns and forms for this domain — lightweight calls
      const [campaignsRes, formsRes] = await Promise.allSettled([
        collecteClient.get<any>('/api/v1/collecte/campaigns', { domain: domainCode, limit: '200' }),
        collecteClient.get<any>('/api/v1/form-builder/templates', { domain: domainCode, limit: '200', status: 'PUBLISHED' }),
      ]);

      const campaigns = campaignsRes.status === 'fulfilled' ? (campaignsRes.value?.data ?? []) : [];
      const forms = formsRes.status === 'fulfilled' ? (formsRes.value?.data ?? []) : [];

      // Group by sub-domain target
      const stats: Record<string, { campaigns: number; forms: number; submissions: number }> = {};

      for (const c of campaigns) {
        const targets = c.targets ?? [];
        for (const t of targets) {
          const sub = t.sub_domain_code ?? t.subDomainCode;
          if (sub) {
            if (!stats[sub]) stats[sub] = { campaigns: 0, forms: 0, submissions: 0 };
            stats[sub].campaigns++;
            stats[sub].submissions += Number(c.submission_count ?? c.submissionCount ?? 0);
          }
        }
        // Also count by legacy domain field
        if (!targets.length && c.domain === domainCode) {
          const key = '__all__';
          if (!stats[key]) stats[key] = { campaigns: 0, forms: 0, submissions: 0 };
          stats[key].campaigns++;
          stats[key].submissions += Number(c.submission_count ?? c.submissionCount ?? 0);
        }
      }

      for (const f of forms) {
        const targets = f.targets ?? [];
        for (const t of targets) {
          const sub = t.sub_domain_code ?? t.subDomainCode;
          if (sub) {
            if (!stats[sub]) stats[sub] = { campaigns: 0, forms: 0, submissions: 0 };
            stats[sub].forms++;
          }
        }
        if (!targets.length) {
          const key = '__all__';
          if (!stats[key]) stats[key] = { campaigns: 0, forms: 0, submissions: 0 };
          stats[key].forms++;
        }
      }

      return stats;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function SubDomainsGrid({ domainCode }: SubDomainsGridProps) {
  const subDomains = useSubDomains(domainCode);
  const { data: stats } = useSubDomainStats(domainCode);

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
          const sdStats = stats?.[sd.code] ?? stats?.['__all__'] ?? { campaigns: 0, forms: 0, submissions: 0 };

          return (
            <Link
              key={sd.id}
              href={`/domains/${domainCode}/${sd.code}`}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Accent line */}
              <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: sd.color ?? '#1F4E79' }} />

              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {React.createElement(ICON_MAP[sd.icon ?? ''] ?? Circle, {
                      className: 'h-4 w-4 shrink-0',
                      style: { color: sd.color ?? '#1F4E79' },
                    })}
                    <h3 className="text-sm font-semibold line-clamp-2 dark:text-white" style={{ color: sd.color ?? undefined }}>
                      {sd.labelEn || sd.labelFr}
                    </h3>
                  </div>
                  {sd.description && (
                    <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">
                      {sd.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600" />
              </div>

              {/* Stats */}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <div className="flex flex-col items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-1 py-1.5">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{sdStats.campaigns}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ClipboardList className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                    <span className="text-[10px] text-blue-500 dark:text-blue-400">Campagnes</span>
                  </div>
                </div>
                <div className="flex flex-col items-center rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-1 py-1.5">
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{sdStats.forms}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <FileText className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400">Formulaires</span>
                  </div>
                </div>
                <div className="flex flex-col items-center rounded-md bg-amber-50 dark:bg-amber-900/20 px-1 py-1.5">
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{sdStats.submissions}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Database className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                    <span className="text-[10px] text-amber-500 dark:text-amber-400">Donnees</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
