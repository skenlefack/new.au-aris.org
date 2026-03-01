'use client';

import React from 'react';
import { useSettingsDomains } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { Loader2 } from 'lucide-react';

export default function DomainsPage() {
  const { isSuperAdmin } = useSettingsAccess();
  const { data, isLoading } = useSettingsDomains();
  const domains: any[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Domains</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          9 ARIS domains covering all animal resources sectors
        </p>
      </div>

      <div className="space-y-3">
        {domains.map((domain: any, idx: number) => (
          <div
            key={domain.id}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: domain.color }}>
              {idx + 1}
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${domain.color}14`, color: domain.color }}
            >
              <span className="text-sm font-bold">{domain.icon?.slice(0, 2) ?? '?'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {domain.name?.en ?? domain.code}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {domain.description?.en}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {domain.code}
              </span>
              <span
                className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: domain.isActive ? '#ecfdf5' : '#f3f4f6',
                  color: domain.isActive ? '#059669' : '#9ca3af',
                }}
              >
                {domain.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
