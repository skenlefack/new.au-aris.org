'use client';

import type { ReactNode } from 'react';
import { usePermissionStore } from '@/lib/stores/permission-store';

interface PermissionGateProps {
  module: string;
  feature: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children only if the user has the specified permission.
 * Falls back to `fallback` (or null) if permission is missing.
 *
 * If permissions haven't been loaded yet, renders nothing (safe default).
 */
export function PermissionGate({
  module,
  feature,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { isLoaded, hasPermission } = usePermissionStore();

  if (!isLoaded) return null;
  if (!hasPermission(module, feature, action)) return <>{fallback}</>;
  return <>{children}</>;
}

interface ModuleGateProps {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children only if the user has access to any feature in the module.
 */
export function ModuleGate({ module, children, fallback = null }: ModuleGateProps) {
  const { isLoaded, hasModuleAccess } = usePermissionStore();

  if (!isLoaded) return null;
  if (!hasModuleAccess(module)) return <>{fallback}</>;
  return <>{children}</>;
}
