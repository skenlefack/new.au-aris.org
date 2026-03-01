'use client';

import { useEffect } from 'react';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { applyEntityTheme, getEntityColor } from '@/lib/theme/colors';

/**
 * Watches the selected tenant and applies its accent color as CSS variables.
 * Call once in the dashboard layout — all children inherit the theme.
 */
export function useEntityTheme() {
  const selectedTenant = useTenantStore((s) => s.selectedTenant);

  useEffect(() => {
    if (!selectedTenant) {
      applyEntityTheme('#006B3F', '#D4A843');
      return;
    }

    const colors = getEntityColor(selectedTenant.code || selectedTenant.name);
    applyEntityTheme(colors.accent, colors.secondary);
  }, [selectedTenant]);
}
