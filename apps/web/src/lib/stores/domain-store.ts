'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Domain {
  id: string;
  code: string;
  name: Record<string, string>;  // { en, fr, pt, ar }
  icon: string;
  color: string;
}

export interface ValueChainCode {
  code: string;
  labelFr: string;
  labelEn: string;
  labelAr: string | null;
  labelPt: string | null;
  active: boolean;
  displayOrder: number;
}

export type SubDomainType = 'VALUE_CHAIN' | 'ORGANIZATIONAL' | 'PATHOLOGY' | 'OTHER';

export interface SubDomain {
  id: string;
  code: string;
  domainCode: string;
  valueChainCode: string | null;
  labelFr: string;
  labelEn: string;
  labelAr: string | null;
  labelPt: string | null;
  typeEnum: SubDomainType;
  active: boolean;
  displayOrder: number;
  description: string | null;
}

interface DomainState {
  /** Domains assigned to the logged-in user (from /auth/login or /users/me) */
  userDomains: Domain[];
  /** All 9 active domains (for admin autocomplete etc.) */
  allDomains: Domain[];
  /** Currently selected domain filter (null = all user domains) */
  activeDomain: string | null;
  isLoading: boolean;

  /** Hierarchical permissions from /me/access: { domainCode: ["*"] | ["SUB1","SUB2"] } */
  domainPermissions: Record<string, string[]>;
  /** Sub-domain metadata from /me/access */
  subDomainsMetadata: SubDomain[];
  /** Value chain codes from /me/access */
  valueChainCodes: ValueChainCode[];
  /** Whether hierarchical data has been hydrated */
  hydrated: boolean;

  // Actions
  setUserDomains: (domains: Domain[]) => void;
  setAllDomains: (domains: Domain[]) => void;
  setActiveDomain: (code: string | null) => void;
  /** Hydrate hierarchical permissions from /me/access response */
  hydrateFromMeAccess: (data: {
    domains: Record<string, string[]>;
    subDomainsDetails: SubDomain[];
    valueChainCodes: ValueChainCode[];
  }) => void;
  /** Check if the current user has access to a specific domain code */
  hasAccess: (domainCode: string) => boolean;
  /** Check access to a specific sub-domain */
  hasAccessToSubDomain: (domainCode: string, subDomainCode: string) => boolean;
  /** Check access to any sub-domain with a value chain code */
  hasAccessToValueChain: (valueChainCode: string) => boolean;
  /** Get array of domain codes the user has */
  getUserDomainCodes: () => string[];
  /** Get accessible sub-domains of a domain, sorted by displayOrder */
  getSubDomainsOfDomain: (domainCode: string) => SubDomain[];
  /** Get sub-domains across all domains with a given value chain code */
  getSubDomainsByValueChain: (valueChainCode: string) => SubDomain[];
  /** Get all value chain codes the user can access */
  getAccessibleValueChainCodes: () => string[];
  /** Reset store on logout */
  reset: () => void;
}

/* ------------------------------------------------------------------ */
/*  Route ↔ Domain code mapping                                        */
/* ------------------------------------------------------------------ */

const ROUTE_TO_DOMAIN: Record<string, string> = {
  '/animal-health': 'animal-health',
  '/livestock': 'livestock-prod',
  '/fisheries': 'fisheries',
  '/wildlife': 'wildlife',
  '/apiculture': 'apiculture',
  '/trade': 'trade-sps',
  '/governance': 'governance',
  '/climate-env': 'climate-env',
  '/knowledge': 'knowledge-hub',
};

const DOMAIN_TO_ROUTE: Record<string, string> = {
  'animal-health': '/animal-health',
  'livestock-prod': '/livestock',
  'fisheries': '/fisheries',
  'wildlife': '/wildlife',
  'apiculture': '/apiculture',
  'trade-sps': '/trade',
  'governance': '/governance',
  'climate-env': '/climate-env',
  'knowledge-hub': '/knowledge',
};

export { ROUTE_TO_DOMAIN, DOMAIN_TO_ROUTE };

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useDomainStore = create<DomainState>()(
  persist(
    (set, get) => ({
      userDomains: [],
      allDomains: [],
      activeDomain: null,
      isLoading: false,
      domainPermissions: {},
      subDomainsMetadata: [],
      valueChainCodes: [],
      hydrated: false,

      setUserDomains: (domains) => {
        set({ userDomains: domains });
        // If user has exactly 1 domain, auto-select it
        if (domains.length === 1) {
          set({ activeDomain: domains[0].code });
        }
      },

      setAllDomains: (domains) => set({ allDomains: domains }),

      setActiveDomain: (code) => set({ activeDomain: code }),

      hydrateFromMeAccess: (data) => {
        set({
          domainPermissions: data.domains,
          subDomainsMetadata: data.subDomainsDetails,
          valueChainCodes: data.valueChainCodes,
          hydrated: true,
        });
      },

      hasAccess: (domainCode) => {
        const { domainPermissions, userDomains } = get();
        // If hierarchical permissions are set, use them
        if (Object.keys(domainPermissions).length > 0) {
          return domainCode in domainPermissions;
        }
        // Fallback to legacy behavior
        if (userDomains.length === 0) return true;
        return userDomains.some((d) => d.code === domainCode);
      },

      hasAccessToSubDomain: (domainCode, subDomainCode) => {
        const subs = get().domainPermissions[domainCode];
        if (!subs) return false;
        return subs.includes('*') || subs.includes(subDomainCode);
      },

      hasAccessToValueChain: (valueChainCode) => {
        const { subDomainsMetadata } = get();
        return subDomainsMetadata
          .filter((sd) => sd.valueChainCode === valueChainCode && sd.active)
          .some((sd) => get().hasAccessToSubDomain(sd.domainCode, sd.code));
      },

      getUserDomainCodes: () => {
        const { domainPermissions, userDomains } = get();
        if (Object.keys(domainPermissions).length > 0) {
          return Object.keys(domainPermissions);
        }
        return userDomains.map((d) => d.code);
      },

      getSubDomainsOfDomain: (domainCode) => {
        return get()
          .subDomainsMetadata.filter(
            (sd) =>
              sd.domainCode === domainCode &&
              sd.active &&
              get().hasAccessToSubDomain(domainCode, sd.code),
          )
          .sort((a, b) => a.displayOrder - b.displayOrder);
      },

      getSubDomainsByValueChain: (valueChainCode) => {
        return get()
          .subDomainsMetadata.filter(
            (sd) =>
              sd.valueChainCode === valueChainCode &&
              sd.active &&
              get().hasAccessToSubDomain(sd.domainCode, sd.code),
          )
          .sort((a, b) => a.displayOrder - b.displayOrder);
      },

      getAccessibleValueChainCodes: () => {
        const accessible = new Set<string>();
        const state = get();
        for (const sd of state.subDomainsMetadata) {
          if (sd.valueChainCode && sd.active && state.hasAccessToSubDomain(sd.domainCode, sd.code)) {
            accessible.add(sd.valueChainCode);
          }
        }
        return Array.from(accessible);
      },

      reset: () =>
        set({
          userDomains: [],
          allDomains: [],
          activeDomain: null,
          isLoading: false,
          domainPermissions: {},
          subDomainsMetadata: [],
          valueChainCodes: [],
          hydrated: false,
        }),
    }),
    {
      name: 'aris-domains',
      partialize: (state) => ({
        activeDomain: state.activeDomain,
        // Don't persist userDomains/allDomains/subdomains — they come from API
      }),
    },
  ),
);
