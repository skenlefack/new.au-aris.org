'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { ShieldAlert } from 'lucide-react';
import { SettingsBackButton } from './SettingsBackButton';

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="space-y-6">
        <SettingsBackButton />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
            This section is reserved for Super Administrators only.
            Contact your system administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
