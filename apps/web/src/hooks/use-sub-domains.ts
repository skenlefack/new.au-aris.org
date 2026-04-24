'use client';

import { useDomainStore } from '@/lib/stores/domain-store';

/** Get accessible sub-domains of a specific domain */
export function useSubDomains(domainCode: string) {
  return useDomainStore((s) => s.getSubDomainsOfDomain(domainCode));
}

/** Get sub-domains across all domains sharing a value chain code */
export function useValueChainSubDomains(valueChainCode: string) {
  return useDomainStore((s) => s.getSubDomainsByValueChain(valueChainCode));
}

/** Get all accessible value chain codes with their metadata, sorted by displayOrder */
export function useAccessibleValueChains() {
  return useDomainStore((s) => {
    const codes = s.getAccessibleValueChainCodes();
    return s.valueChainCodes
      .filter((vc) => codes.includes(vc.code) && vc.active)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  });
}
