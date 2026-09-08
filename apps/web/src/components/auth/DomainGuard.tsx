'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore, type UserRole } from '@/lib/stores/auth-store';
import { useDomainStore, ROUTE_TO_DOMAIN } from '@/lib/stores/domain-store';

/** Roles that bypass domain restrictions (see all domains). */
const ADMIN_ROLES: Set<UserRole> = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

/**
 * Redirects users to /home when they navigate to a domain page they don't have access to.
 * Admins (SUPER_ADMIN, CONTINENTAL_ADMIN) always pass.
 * Renders children unconditionally — redirect is a side-effect.
 */
export function DomainGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const hasAccess = useDomainStore((s) => s.hasAccess);

  useEffect(() => {
    if (!role) return; // not logged in yet
    if (ADMIN_ROLES.has(role)) return; // admins bypass

    // Check if current path matches a domain route
    for (const [routePrefix, domainCode] of Object.entries(ROUTE_TO_DOMAIN)) {
      if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
        if (!hasAccess(domainCode)) {
          router.replace('/home');
          return;
        }
        break;
      }
    }
  }, [pathname, role, hasAccess, router]);

  return <>{children}</>;
}
