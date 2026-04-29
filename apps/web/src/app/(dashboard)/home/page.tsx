'use client';

import React, { useState } from 'react';
import { LayoutDashboard, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardSection } from '@/components/domain/DashboardSection';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { DashboardScope } from '@/lib/api/dashboard-hooks';

function resolveScope(role?: string, tenantLevel?: string): DashboardScope {
  if (role === 'SUPER_ADMIN' || role === 'CONTINENTAL_ADMIN') return 'CONTINENTAL';
  if (role === 'REC_ADMIN') return 'REC';
  if (tenantLevel === 'CONTINENTAL') return 'CONTINENTAL';
  if (tenantLevel === 'REC') return 'REC';
  return 'COUNTRY';
}

type HomeTab = 'default' | 'custom';

export default function DashboardHomePage() {
  const user = useAuthStore((s) => s.user);
  const scope = resolveScope(user?.role, user?.tenantLevel);
  const [activeTab, setActiveTab] = useState<HomeTab>('default');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800/50 p-1 max-w-md">
        <button
          onClick={() => setActiveTab('default')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
            activeTab === 'default'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700',
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Tableau de bord
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
            activeTab === 'custom'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700',
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Personnalise
        </button>
      </div>

      {/* Content */}
      {activeTab === 'default' ? (
        <DashboardPage />
      ) : (
        <DashboardSection
          scope={scope}
          target={{}}
          zone="principal"
        />
      )}
    </div>
  );
}
