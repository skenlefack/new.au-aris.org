'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampaigns } from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';

interface DomainCampaignsSectionProps {
  domain: string;
}

export function DomainCampaignsSection({ domain }: DomainCampaignsSectionProps) {
  const { data, isLoading, isError } = useCampaigns({
    domain,
    status: 'ACTIVE',
    limit: 5,
  });

  const campaigns = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="rounded-card border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Active Campaigns
          </h2>
        </div>
        <Link
          href={`/collecte?domain=${domain}`}
          className="flex items-center gap-1 text-xs font-medium text-aris-primary-600 hover:text-aris-primary-700 dark:text-aris-primary-400"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : (isError || campaigns.length === 0) ? (
        <div className="mt-6 flex flex-col items-center py-4 text-center">
          <ClipboardList className="h-8 w-8 text-gray-200 dark:text-gray-600" />
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
            No active campaigns for this domain
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {campaigns.map((campaign) => {
            const progress =
              campaign.targetSubmissions && campaign.targetSubmissions > 0
                ? Math.min(
                    100,
                    Math.round(
                      ((campaign.totalSubmissions ?? 0) /
                        campaign.targetSubmissions) *
                        100,
                    ),
                  )
                : 0;
            return (
              <Link
                key={campaign.id}
                href={`/collecte/campaigns/${campaign.id}`}
                className="block rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1 dark:text-gray-100">
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {campaign.totalSubmissions ?? 0}
                      {campaign.targetSubmissions
                        ? ` / ${campaign.targetSubmissions}`
                        : ''}{' '}
                      submissions
                    </p>
                  </div>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    )}
                  >
                    Active
                  </span>
                </div>
                {campaign.targetSubmissions && campaign.targetSubmissions > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-aris-primary-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-gray-400">
                      {progress}%
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
