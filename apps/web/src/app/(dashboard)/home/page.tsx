'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { DashboardSection } from '@/components/domain/DashboardSection';
import type { DashboardScope } from '@/lib/api/dashboard-hooks';

function resolveScope(role?: string, tenantLevel?: string): DashboardScope {
  if (role === 'SUPER_ADMIN' || role === 'CONTINENTAL_ADMIN') return 'CONTINENTAL';
  if (role === 'REC_ADMIN') return 'REC';
  if (tenantLevel === 'CONTINENTAL') return 'CONTINENTAL';
  if (tenantLevel === 'REC') return 'REC';
  return 'COUNTRY';
}

export default function DashboardHomePage() {
  const user = useAuthStore((s) => s.user);
  const scope = resolveScope(user?.role, user?.tenantLevel);

  return (
    <div className="space-y-6">
      <DashboardSection
        scope={scope}
        target={{}}
        zone="principal"
      />
    </div>
  );
}
