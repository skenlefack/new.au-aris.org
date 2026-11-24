import { describe, it, expect } from 'vitest';
import { filterLevelsForCountry } from '../admin-location-levels';
import type { AdminLevel } from '@/lib/api/settings-hooks';

const lvl = (level: number, isActive = true): AdminLevel => ({
  id: `uuid-${level}`, level, code: `l${level}`, name: { en: `L${level}` }, isActive,
});

describe('filterLevelsForCountry', () => {
  const formLevels = [0, 1, 2, 3, 4, 5];

  it('shows only the levels configured for the country (Burundi: 4 levels)', () => {
    const bi = [lvl(1), lvl(2), lvl(3), lvl(4)];
    expect(filterLevelsForCountry(formLevels, bi, false)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps the form limit when the country has more levels than the form', () => {
    const ke = [lvl(1), lvl(2), lvl(3), lvl(4), lvl(5)];
    expect(filterLevelsForCountry([0, 1, 2], ke, false)).toEqual([0, 1, 2]);
  });

  it('hides inactive levels', () => {
    const bf = [lvl(1), lvl(2), lvl(3), lvl(4, false)];
    expect(filterLevelsForCountry(formLevels, bf, false)).toEqual([0, 1, 2, 3]);
  });

  it('keeps the form levels when the country has no configuration', () => {
    expect(filterLevelsForCountry(formLevels, [], false)).toEqual(formLevels);
  });

  it('ignores GADM fallback levels', () => {
    const gadm = [{ ...lvl(1), id: 'gadm-XX-1' }, { ...lvl(2), id: 'gadm-XX-2' }];
    expect(filterLevelsForCountry(formLevels, gadm, false)).toEqual(formLevels);
  });

  it('shows only the country while the configuration is loading', () => {
    expect(filterLevelsForCountry(formLevels, [], true)).toEqual([0]);
  });
});
