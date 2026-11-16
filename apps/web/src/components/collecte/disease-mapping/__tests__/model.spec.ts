import { describe, it, expect } from 'vitest';
import type { CampaignDataset, CampaignDatasetRow } from '@/lib/api/workflow-hooks';
import {
  toHerd, buildHerds, indicators, isPprSuspect, riskLevelOf, relativeRisks, crossTab, counts,
  chiSquarePValue, dailySeries, weekOf, toCsv, RISK_WEIGHTS,
} from '../model';

const lookups = { agents: { u1: 'Agent One' }, tenants: { t1: { name: 'Rwanda', code: 'RW', level: 'MEMBER_STATE' } } };

function row(id: string, data: Record<string, unknown>, extra: Partial<CampaignDatasetRow> = {}): CampaignDatasetRow {
  return { id, tenantId: 't1', submittedBy: 'u1', submittedAt: '2026-11-13T10:00:00.000Z', status: 'SUBMITTED', data, ...extra };
}

const healthy = {
  admin_location: { level_0: 'RW', level_1: 'p1', level_2: 'd1', level_3: 's1' },
  geo_location: { lat: -2.1, lng: 29.6 },
  production_system: 'sedentary',
  goats_count: 20, sheep_count: 5,
  vaccinated_ppr: 'yes', vaccination_coverage: '>75%', vaccination_date: '2026-09-13',
  vet_access: 'yes', animals_move: 'no', shared_grazing: 'no', recent_additions: 'no',
  neighbor_disease: 'no', biosecurity_measures: ['movement_control'], clinical_signs: [],
};

const sick = {
  ...healthy,
  admin_location: { level_0: 'RW', level_1: 'p1', level_2: 'd2', level_3: 's2' },
  clinical_signs: ['fever', 'nasal_discharge', 'diarrhea'],
  animals_affected: 10, animals_died: 4,
  vaccinated_ppr: 'no', animals_move: 'yes', shared_grazing: 'yes', recent_additions: 'yes',
  neighbor_disease: 'yes', biosecurity_measures: ['none'], vet_access: 'no',
};

describe('isPprSuspect', () => {
  it('needs fever plus two other signs', () => {
    expect(isPprSuspect(['fever', 'nasal_discharge', 'diarrhea'])).toBe(true);
    expect(isPprSuspect(['fever', 'nasal_discharge', 'ocular_discharge'])).toBe(false); // discharge counts once
    expect(isPprSuspect(['nasal_discharge', 'diarrhea', 'coughing'])).toBe(false); // no fever
  });
});

describe('toHerd', () => {
  it('maps a healthy, well-protected herd to a low score', () => {
    const h = toHerd(row('a', healthy), lookups);
    expect(h.country).toBe('RW');
    expect(h.animals).toBe(25);
    expect(h.sizeClass).toBe('11-50');
    expect(h.anySign).toBe(false);
    expect(h.monthsSinceVaccination).toBe(2);
    expect(h.risk).toBe(0);
    expect(h.riskLevel).toBe('low');
  });

  it('adds every weight when all risk factors are present', () => {
    const h = toHerd(row('b', sick), lookups);
    expect(h.pprSuspect).toBe(true);
    expect(Object.values(h.factors).every(Boolean)).toBe(true);
    expect(h.risk).toBe(Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0));
    expect(h.risk).toBe(100);
    expect(h.riskLevel).toBe('veryHigh');
  });

  it('treats low coverage as insufficient vaccination and ignores missing GPS', () => {
    const h = toHerd(row('c', { ...healthy, vaccination_coverage: '<25%', geo_location: null }), lookups);
    expect(h.factors.notVaccinated).toBe(true);
    expect(h.lat).toBeNull();
  });
});

describe('aggregates', () => {
  const ds: CampaignDataset = {
    rows: [row('a', healthy), row('b', sick), row('c', healthy, { submittedAt: '2026-11-15T09:00:00.000Z', status: 'VALIDATED' })],
    geo: {}, fields: {}, generatedAt: '', ...lookups,
  };
  const herds = buildHerds(ds);

  it('computes indicators on answered questions', () => {
    const i = indicators(herds);
    expect(i.herds).toBe(3);
    expect(i.withSigns).toBe(1);
    expect(i.suspects).toBe(1);
    expect(i.caseFatality).toBeCloseTo(40);
    expect(i.pctVaccinated).toBeCloseTo(66.67, 1);
    expect(i.pctValidated).toBeCloseTo(33.33, 1);
    expect(i.days).toBe(2);
  });

  it('counts and cross-tabulates', () => {
    expect(counts(herds, 'l2')).toEqual([{ key: 'd1', value: 2 }, { key: 'd2', value: 1 }]);
    const ct = crossTab(herds, 'l2', 'vaccinated');
    expect(ct.cells['d1']).toEqual({ yes: 2 });
    expect(ct.cells['d2']).toEqual({ no: 1 });
    expect(ct.total).toBe(3);
  });

  it('fills idle days in the daily series', () => {
    const s = dailySeries(herds, (h) => h.country);
    expect(s.map((d) => d.day)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
    expect(s[1]['RW']).toBeUndefined();
  });
});

describe('relativeRisks', () => {
  it('matches a hand-computed 2x2 table', () => {
    // 10 exposed (6 sick), 20 unexposed (4 sick) → RR = 0.6 / 0.2 = 3
    const rows: CampaignDatasetRow[] = [];
    for (let i = 0; i < 30; i++) {
      const exposed = i < 10;
      const ill = exposed ? i < 6 : i < 14;
      rows.push(row(`r${i}`, { ...healthy, animals_move: exposed ? 'yes' : 'no', clinical_signs: ill ? ['coughing'] : [] }));
    }
    const rr = relativeRisks(buildHerds({ rows, geo: {}, fields: {}, generatedAt: '', ...lookups })).find((r) => r.factor === 'movesOut')!;
    expect(rr.exposed).toBe(10);
    expect(rr.rr).toBeCloseTo(3);
    expect(rr.low!).toBeLessThan(3);
    expect(rr.high!).toBeGreaterThan(3);
  });
});

describe('statistics and helpers', () => {
  it('chi-square p-values match reference tables', () => {
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(5.991, 2)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(0, 1)).toBe(1);
  });

  it('risk levels follow the published bands', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(riskLevelOf)).toEqual(['low', 'low', 'moderate', 'moderate', 'high', 'high', 'veryHigh', 'veryHigh']);
  });

  it('week starts on Monday', () => {
    expect(weekOf('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(weekOf('2026-11-15')).toBe('2026-11-09'); // Sunday
  });

  it('escapes CSV values', () => {
    expect(toCsv([['a,b', 'c"d', 1]])).toBe('﻿"a,b","c""d",1');
  });
});
