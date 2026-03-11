'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api/client';

export type TenantLevel = 'CONTINENTAL' | 'REC' | 'MEMBER_STATE';

export interface TenantNode {
  id: string;
  name: string;
  code: string;
  level: TenantLevel;
  children?: TenantNode[];
}

/** Recursively find a tenant node by its id in the tree */
export function findTenantById(
  tree: TenantNode[],
  id: string,
): TenantNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findTenantById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Recursively find a tenant node by its code (case-insensitive) */
export function findTenantByCode(
  tree: TenantNode[],
  code: string,
): TenantNode | null {
  const upper = code.toUpperCase();
  for (const node of tree) {
    if (node.code.toUpperCase() === upper) return node;
    if (node.children) {
      const found = findTenantByCode(node.children, code);
      if (found) return found;
    }
  }
  return null;
}

/** Find the parent REC node for a given member-state tenant (matches by id or code) */
export function findParentRec(
  tree: TenantNode[],
  childIdOrCode: string,
): TenantNode | null {
  const upper = childIdOrCode.toUpperCase();
  for (const node of tree) {
    if (node.level === 'REC' && node.children) {
      for (const child of node.children) {
        if (child.id === childIdOrCode || child.code.toUpperCase() === upper) return node;
      }
    }
    if (node.children) {
      const found = findParentRec(node.children, childIdOrCode);
      if (found) return found;
    }
  }
  return null;
}

/** Extract 2-letter country code from email like admin@ke.au-aris.org → 'KE' */
export function deriveCountryCodeFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const m = email.match(/@([a-z]{2})\.au-aris\.org$/i);
  return m ? m[1].toUpperCase() : null;
}

interface TenantState {
  selectedTenantId: string | null;
  selectedTenant: TenantNode | null;
  tenantTree: TenantNode[];
  isLoading: boolean;
  setSelectedTenant: (tenantId: string, tenant: TenantNode) => void;
  setTenantTree: (tree: TenantNode[]) => void;
  clearTenant: () => void;
  fetchTenantTree: () => Promise<void>;
  /** Sync the store to the logged-in user's tenant, called after login */
  initFromUser: (userTenantId: string, email?: string) => void;
}

export const PLACEHOLDER_TENANT_TREE: TenantNode[] = [
  {
    id: 'au-ibar',
    name: 'AU-IBAR',
    code: 'AU',
    level: 'CONTINENTAL',
    children: [
      {
        id: 'igad', name: 'IGAD', code: 'IGAD', level: 'REC',
        children: [
          { id: 'ke', name: 'Kenya', code: 'KE', level: 'MEMBER_STATE' },
          { id: 'et', name: 'Ethiopia', code: 'ET', level: 'MEMBER_STATE' },
          { id: 'ug', name: 'Uganda', code: 'UG', level: 'MEMBER_STATE' },
          { id: 'so', name: 'Somalia', code: 'SO', level: 'MEMBER_STATE' },
          { id: 'dj', name: 'Djibouti', code: 'DJ', level: 'MEMBER_STATE' },
          { id: 'er', name: 'Eritrea', code: 'ER', level: 'MEMBER_STATE' },
          { id: 'sd', name: 'Sudan', code: 'SD', level: 'MEMBER_STATE' },
          { id: 'ss', name: 'South Sudan', code: 'SS', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'ecowas', name: 'ECOWAS', code: 'ECOWAS', level: 'REC',
        children: [
          { id: 'ng', name: 'Nigeria', code: 'NG', level: 'MEMBER_STATE' },
          { id: 'sn', name: 'Senegal', code: 'SN', level: 'MEMBER_STATE' },
          { id: 'bj', name: 'Benin', code: 'BJ', level: 'MEMBER_STATE' },
          { id: 'bf', name: 'Burkina Faso', code: 'BF', level: 'MEMBER_STATE' },
          { id: 'cv', name: 'Cabo Verde', code: 'CV', level: 'MEMBER_STATE' },
          { id: 'ci', name: "Côte d'Ivoire", code: 'CI', level: 'MEMBER_STATE' },
          { id: 'gm', name: 'Gambia', code: 'GM', level: 'MEMBER_STATE' },
          { id: 'gh', name: 'Ghana', code: 'GH', level: 'MEMBER_STATE' },
          { id: 'gn', name: 'Guinea', code: 'GN', level: 'MEMBER_STATE' },
          { id: 'gw', name: 'Guinea-Bissau', code: 'GW', level: 'MEMBER_STATE' },
          { id: 'lr', name: 'Liberia', code: 'LR', level: 'MEMBER_STATE' },
          { id: 'ml', name: 'Mali', code: 'ML', level: 'MEMBER_STATE' },
          { id: 'ne', name: 'Niger', code: 'NE', level: 'MEMBER_STATE' },
          { id: 'sl', name: 'Sierra Leone', code: 'SL', level: 'MEMBER_STATE' },
          { id: 'tg', name: 'Togo', code: 'TG', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'sadc', name: 'SADC', code: 'SADC', level: 'REC',
        children: [
          { id: 'za', name: 'South Africa', code: 'ZA', level: 'MEMBER_STATE' },
          { id: 'bw', name: 'Botswana', code: 'BW', level: 'MEMBER_STATE' },
          { id: 'km', name: 'Comoros', code: 'KM', level: 'MEMBER_STATE' },
          { id: 'sz', name: 'Eswatini', code: 'SZ', level: 'MEMBER_STATE' },
          { id: 'ls', name: 'Lesotho', code: 'LS', level: 'MEMBER_STATE' },
          { id: 'mg', name: 'Madagascar', code: 'MG', level: 'MEMBER_STATE' },
          { id: 'mw', name: 'Malawi', code: 'MW', level: 'MEMBER_STATE' },
          { id: 'mu', name: 'Mauritius', code: 'MU', level: 'MEMBER_STATE' },
          { id: 'mz', name: 'Mozambique', code: 'MZ', level: 'MEMBER_STATE' },
          { id: 'na', name: 'Namibia', code: 'NA', level: 'MEMBER_STATE' },
          { id: 'sc', name: 'Seychelles', code: 'SC', level: 'MEMBER_STATE' },
          { id: 'zm', name: 'Zambia', code: 'ZM', level: 'MEMBER_STATE' },
          { id: 'zw', name: 'Zimbabwe', code: 'ZW', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'eac', name: 'EAC', code: 'EAC', level: 'REC',
        children: [
          { id: 'tz', name: 'Tanzania', code: 'TZ', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'eccas', name: 'ECCAS', code: 'ECCAS', level: 'REC',
        children: [
          { id: 'ao', name: 'Angola', code: 'AO', level: 'MEMBER_STATE' },
          { id: 'bi', name: 'Burundi', code: 'BI', level: 'MEMBER_STATE' },
          { id: 'cm', name: 'Cameroon', code: 'CM', level: 'MEMBER_STATE' },
          { id: 'cf', name: 'Central African Rep.', code: 'CF', level: 'MEMBER_STATE' },
          { id: 'td', name: 'Chad', code: 'TD', level: 'MEMBER_STATE' },
          { id: 'cg', name: 'Congo', code: 'CG', level: 'MEMBER_STATE' },
          { id: 'cd', name: 'DR Congo', code: 'CD', level: 'MEMBER_STATE' },
          { id: 'gq', name: 'Equatorial Guinea', code: 'GQ', level: 'MEMBER_STATE' },
          { id: 'ga', name: 'Gabon', code: 'GA', level: 'MEMBER_STATE' },
          { id: 'rw', name: 'Rwanda', code: 'RW', level: 'MEMBER_STATE' },
          { id: 'st', name: 'São Tomé', code: 'ST', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'uma', name: 'UMA', code: 'UMA', level: 'REC',
        children: [
          { id: 'dz', name: 'Algeria', code: 'DZ', level: 'MEMBER_STATE' },
          { id: 'ly', name: 'Libya', code: 'LY', level: 'MEMBER_STATE' },
          { id: 'mr', name: 'Mauritania', code: 'MR', level: 'MEMBER_STATE' },
          { id: 'ma', name: 'Morocco', code: 'MA', level: 'MEMBER_STATE' },
          { id: 'tn', name: 'Tunisia', code: 'TN', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'censad', name: 'CEN-SAD', code: 'CENSAD', level: 'REC',
        children: [],
      },
      {
        id: 'comesa', name: 'COMESA', code: 'COMESA', level: 'REC',
        children: [
          { id: 'eg', name: 'Egypt', code: 'EG', level: 'MEMBER_STATE' },
        ],
      },
    ],
  },
];

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      selectedTenantId: 'au-ibar',
      selectedTenant: PLACEHOLDER_TENANT_TREE[0],
      tenantTree: PLACEHOLDER_TENANT_TREE,
      isLoading: false,
      setSelectedTenant: (tenantId, tenant) =>
        set({ selectedTenantId: tenantId, selectedTenant: tenant }),
      setTenantTree: (tree) => set({ tenantTree: tree }),
      clearTenant: () =>
        set({ selectedTenantId: null, selectedTenant: null }),
      initFromUser: (userTenantId: string, email?: string) => {
        const { tenantTree } = get();
        // Try exact id match, then code match, then email-derived code
        let node =
          findTenantById(tenantTree, userTenantId) ??
          findTenantByCode(tenantTree, userTenantId);
        if (!node && email) {
          const code = deriveCountryCodeFromEmail(email);
          if (code) {
            node = findTenantByCode(tenantTree, code) ?? findTenantById(tenantTree, code.toLowerCase());
          }
        }
        if (node) {
          set({ selectedTenantId: node.id, selectedTenant: node });
        }
      },
      fetchTenantTree: async () => {
        // Avoid duplicate fetches
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const response = await apiClient.get<{ data: TenantNode[] }>(
            '/tenants',
          );
          const tree = response?.data;
          if (tree && Array.isArray(tree) && tree.length > 0) {
            set({ tenantTree: tree });

            // If no tenant is currently selected, default to root
            const { selectedTenantId } = get();
            if (!selectedTenantId) {
              set({
                selectedTenantId: tree[0].id,
                selectedTenant: tree[0],
              });
            }
          }
          // If the API returns empty/invalid data, keep the placeholder
        } catch {
          // On error, keep the existing placeholder tree
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'aris-tenant',
      partialize: (state) => ({
        selectedTenantId: state.selectedTenantId,
        selectedTenant: state.selectedTenant,
      }),
    },
  ),
);
