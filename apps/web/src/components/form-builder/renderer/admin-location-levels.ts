import type { AdminLevel } from '@/lib/api/settings-hooks';

/**
 * Restrict the form's levels to the active admin levels configured for the country
 * in Settings > Countries.
 * - Country (level 0) is always kept.
 * - While the country config is loading, only level 0 is shown (avoids showing 5 levels then 3).
 * - Without a real country config (empty, or GADM fallback ids `gadm-*`), the form's levels are kept.
 */
export function filterLevelsForCountry(
  levels: number[],
  adminLevels: AdminLevel[],
  loading: boolean,
): number[] {
  if (loading) return levels.filter((l) => l === 0);
  const configured = adminLevels.filter((a) => !String(a.id ?? '').startsWith('gadm-'));
  if (configured.length === 0) return levels;
  const active = new Set(configured.filter((a) => a.isActive !== false).map((a) => a.level));
  return levels.filter((l) => l === 0 || active.has(l));
}
