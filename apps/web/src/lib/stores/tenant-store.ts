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

interface TenantState {
  selectedTenantId: string | null;
  selectedTenant: TenantNode | null;
  tenantTree: TenantNode[];
  isLoading: boolean;
  setSelectedTenant: (tenantId: string, tenant: TenantNode) => void;
  setTenantTree: (tree: TenantNode[]) => void;
  clearTenant: () => void;
  fetchTenantTree: () => Promise<void>;
}

export const PLACEHOLDER_TENANT_TREE: TenantNode[] = [
  {
    id: 'au-ibar',
    name: 'AU-IBAR',
    code: 'AU',
    level: 'CONTINENTAL',
    children: [
      {
        id: 'igad',
        name: 'IGAD',
        code: 'IGAD',
        level: 'REC',
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
        id: 'ecowas',
        name: 'ECOWAS',
        code: 'ECOWAS',
        level: 'REC',
        children: [
          { id: 'ng', name: 'Nigeria', code: 'NG', level: 'MEMBER_STATE' },
          { id: 'sn', name: 'Senegal', code: 'SN', level: 'MEMBER_STATE' },
          { id: 'gh', name: 'Ghana', code: 'GH', level: 'MEMBER_STATE' },
          { id: 'ml', name: 'Mali', code: 'ML', level: 'MEMBER_STATE' },
          { id: 'ne', name: 'Niger', code: 'NE', level: 'MEMBER_STATE' },
          { id: 'bf', name: 'Burkina Faso', code: 'BF', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'sadc',
        name: 'SADC',
        code: 'SADC',
        level: 'REC',
        children: [
          { id: 'za', name: 'South Africa', code: 'ZA', level: 'MEMBER_STATE' },
          { id: 'tz', name: 'Tanzania', code: 'TZ', level: 'MEMBER_STATE' },
          { id: 'mz', name: 'Mozambique', code: 'MZ', level: 'MEMBER_STATE' },
          { id: 'zw', name: 'Zimbabwe', code: 'ZW', level: 'MEMBER_STATE' },
          { id: 'bw', name: 'Botswana', code: 'BW', level: 'MEMBER_STATE' },
        ],
      },
      {
        id: 'eccas',
        name: 'ECCAS',
        code: 'ECCAS',
        level: 'REC',
        children: [
          { id: 'cd', name: 'DR Congo', code: 'CD', level: 'MEMBER_STATE' },
          { id: 'cm', name: 'Cameroon', code: 'CM', level: 'MEMBER_STATE' },
          { id: 'cg', name: 'Congo', code: 'CG', level: 'MEMBER_STATE' },
          { id: 'ga', name: 'Gabon', code: 'GA', level: 'MEMBER_STATE' },
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
