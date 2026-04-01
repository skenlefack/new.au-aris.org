'use client';

import { usePermissionStore } from '@/lib/stores/permission-store';

/**
 * Check if the current user has a specific permission.
 * Returns false if permissions haven't loaded yet (backward compat: falls through to role-based checks).
 */
export function usePermission(module: string, feature: string, action: string): boolean {
  const { isLoaded, hasPermission } = usePermissionStore();
  if (!isLoaded) return false;
  return hasPermission(module, feature, action);
}

/**
 * Check if the current user has access to any feature within a module.
 */
export function useModuleAccess(module: string): boolean {
  const { isLoaded, hasModuleAccess } = usePermissionStore();
  if (!isLoaded) return false;
  return hasModuleAccess(module);
}

/**
 * Check if the current user has any of the specified actions on a feature.
 */
export function useAnyPermission(module: string, feature: string, actions: string[]): boolean {
  const { isLoaded, hasAnyPermission } = usePermissionStore();
  if (!isLoaded) return false;
  return hasAnyPermission(module, feature, actions);
}
