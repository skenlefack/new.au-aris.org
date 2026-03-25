'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useDomainStore } from '@/lib/stores/domain-store';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';

/**
 * HOC that protects a page by checking if the user has access to the required domain.
 * If the user doesn't have access, shows a ForbiddenPage.
 *
 * Usage:
 *   export default withDomainAccess('animal-health')(AnimalHealthPage);
 */
export function withDomainAccess(domainCode: string) {
  return function <P extends object>(WrappedComponent: React.ComponentType<P>) {
    function DomainGuard(props: P) {
      const hasAccess = useDomainStore((s) => s.hasAccess);
      const userDomains = useDomainStore((s) => s.userDomains);

      // If userDomains is empty, the store hasn't been populated yet (or user is SUPER_ADMIN)
      // hasAccess returns true when userDomains is empty (backwards-compatible)
      if (!hasAccess(domainCode)) {
        return <ForbiddenPage />;
      }

      return <WrappedComponent {...props} />;
    }

    DomainGuard.displayName = `withDomainAccess(${domainCode})(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return DomainGuard;
  };
}
