'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PermissionEntry {
  module: string;
  feature: string;
  action: string;
}

interface PermissionState {
  roles: string[];
  permissions: PermissionEntry[];
  isLoaded: boolean;
  setPermissions: (roles: string[], permissions: PermissionEntry[]) => void;
  hasPermission: (module: string, feature: string, action: string) => boolean;
  hasAnyPermission: (module: string, feature: string, actions: string[]) => boolean;
  hasModuleAccess: (module: string) => boolean;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      roles: [],
      permissions: [],
      isLoaded: false,

      setPermissions: (roles, permissions) =>
        set({ roles, permissions, isLoaded: true }),

      hasPermission: (module, feature, action) => {
        const state = get();
        // SUPER_ADMIN always has access
        if (state.roles.includes('SUPER_ADMIN')) return true;
        return state.permissions.some(
          (p) => p.module === module && p.feature === feature && p.action === action,
        );
      },

      hasAnyPermission: (module, feature, actions) => {
        const state = get();
        if (state.roles.includes('SUPER_ADMIN')) return true;
        return actions.some((action) =>
          state.permissions.some(
            (p) => p.module === module && p.feature === feature && p.action === action,
          ),
        );
      },

      hasModuleAccess: (module) => {
        const state = get();
        if (state.roles.includes('SUPER_ADMIN')) return true;
        return state.permissions.some((p) => p.module === module);
      },

      reset: () => set({ roles: [], permissions: [], isLoaded: false }),
    }),
    {
      name: 'aris-permissions',
      partialize: (state) => ({
        roles: state.roles,
        permissions: state.permissions,
        isLoaded: state.isLoaded,
      }),
    },
  ),
);
