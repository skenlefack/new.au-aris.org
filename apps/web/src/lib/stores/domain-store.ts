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

interface DomainState {
  /** Domains assigned to the logged-in user (from /auth/login or /users/me) */
  userDomains: Domain[];
  /** All 9 active domains (for admin autocomplete etc.) */
  allDomains: Domain[];
  /** Currently selected domain filter (null = all user domains) */
  activeDomain: string | null;
  isLoading: boolean;

  // Actions
  setUserDomains: (domains: Domain[]) => void;
  setAllDomains: (domains: Domain[]) => void;
  setActiveDomain: (code: string | null) => void;
  /** Check if the current user has access to a specific domain code */
  hasAccess: (domainCode: string) => boolean;
  /** Get array of domain codes the user has */
  getUserDomainCodes: () => string[];
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

      setUserDomains: (domains) => {
        set({ userDomains: domains });
        // If user has exactly 1 domain, auto-select it
        if (domains.length === 1) {
          set({ activeDomain: domains[0].code });
        }
      },

      setAllDomains: (domains) => set({ allDomains: domains }),

      setActiveDomain: (code) => set({ activeDomain: code }),

      hasAccess: (domainCode) => {
        const { userDomains } = get();
        // Empty domains = no restriction (SUPER_ADMIN gets all at login)
        if (userDomains.length === 0) return true;
        return userDomains.some((d) => d.code === domainCode);
      },

      getUserDomainCodes: () => {
        return get().userDomains.map((d) => d.code);
      },

      reset: () => set({
        userDomains: [],
        allDomains: [],
        activeDomain: null,
        isLoading: false,
      }),
    }),
    {
      name: 'aris-domains',
      partialize: (state) => ({
        activeDomain: state.activeDomain,
        // Don't persist userDomains/allDomains — they come from API on login
      }),
    },
  ),
);
