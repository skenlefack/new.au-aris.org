import { describe, it, expect } from 'vitest';
import { parseRule, valuesMatch, matchCandidates, clusterDuplicates, isProbableDuplicate, adminLeaf, stableJson } from './duplicate-rules';

const schema = (dd: unknown) => ({
  sections: [{
    fields: [
      { code: 'admin_location', type: 'admin-location' },
      { code: 'production_system', type: 'select' },
      { code: 'goats_count', type: 'number' },
      { code: 'sheep_count', type: 'number' },
      { code: 'age_distribution', type: 'multi-select' },
      { code: 'first_case_date', type: 'date' },
      { code: 'owner', type: 'text' },
    ],
  }],
  settings: { duplicateDetection: dd },
});

const DM_RULE = { enabled: true, action: 'warn', fields: ['admin_location', 'production_system', 'goats_count', 'sheep_count', 'age_distribution'] };

const herd = (over: Record<string, unknown> = {}) => ({
  admin_location: { level_0: 'RW', level_1: 'p1', level_2: 'd1', level_5: 'v1' },
  production_system: 'sedentary', goats_count: 150, sheep_count: 0,
  age_distribution: ['<_6_months', '6-12_months', '>_1_year'],
  ...over,
});

describe('parseRule', () => {
  it('stays off for legacy settings without an action (no change for existing forms)', () => {
    expect(parseRule(schema({ enabled: true, fields: ['goats_count'] }))).toBeNull();
    expect(parseRule(schema({ enabled: false, fields: [] }))).toBeNull();
    expect(parseRule(schema(false))).toBeNull();
    expect(parseRule(schema({ enabled: true, action: 'warn', fields: [] }))).toBeNull();
    expect(parseRule(null)).toBeNull();
  });

  it('infers how each field is compared from the form', () => {
    const r = parseRule(schema({ ...DM_RULE, tolerances: { goats_count: 2 } }))!;
    expect(r.action).toBe('warn');
    expect(r.fields.map((f) => [f.code, f.kind, f.tolerance])).toEqual([
      ['admin_location', 'admin', 0], ['production_system', 'exact', 0], ['goats_count', 'number', 2],
      ['sheep_count', 'number', 0], ['age_distribution', 'set', 0],
    ]);
  });
});

describe('matching', () => {
  const rule = parseRule(schema(DM_RULE))!;

  it('matches the same herd regardless of order, number format or GPS', () => {
    const b = herd({ goats_count: '150', age_distribution: ['>_1_year', '<_6_months', '6-12_months'], geo_location: { lat: 1, lng: 2 } });
    expect(isProbableDuplicate(rule, herd(), b)).toBe(true);
  });

  it('does not match another village, system or herd size', () => {
    expect(isProbableDuplicate(rule, herd(), herd({ admin_location: { level_0: 'RW', level_5: 'v2' } }))).toBe(false);
    expect(isProbableDuplicate(rule, herd(), herd({ production_system: 'pastoral' }))).toBe(false);
    expect(isProbableDuplicate(rule, herd(), herd({ goats_count: 151 }))).toBe(false);
  });

  it('applies tolerances and text normalisation', () => {
    expect(valuesMatch({ code: 'n', kind: 'number', tolerance: 2 }, 10, 12)).toBe(true);
    expect(valuesMatch({ code: 'd', kind: 'date', tolerance: 7 }, '2026-11-01', '2026-11-07')).toBe(true);
    expect(valuesMatch({ code: 'd', kind: 'date', tolerance: 3 }, '2026-11-01', '2026-11-07')).toBe(false);
    expect(valuesMatch({ code: 't', kind: 'text', tolerance: 0 }, '  Jean  Mugabo', 'jean mugabo')).toBe(true);
    expect(valuesMatch({ code: 't', kind: 'text', tolerance: 0 }, 'Élevage', 'elevage')).toBe(true);
    expect(valuesMatch({ code: 'x', kind: 'exact', tolerance: 0 }, '', null)).toBe(true);
    expect(valuesMatch({ code: 'x', kind: 'exact', tolerance: 0 }, 'a', null)).toBe(false);
  });

  it('uses GPS distance only when both fiches have a point', () => {
    const r = parseRule(schema({ ...DM_RULE, gpsField: 'geo_location', gpsMeters: 100 }))!;
    const a = herd({ geo_location: { lat: -1.95, lng: 30.06 } });
    expect(isProbableDuplicate(r, a, herd({ geo_location: { lat: -1.9505, lng: 30.0601 } }))).toBe(true);
    expect(isProbableDuplicate(r, a, herd({ geo_location: { lat: -1.96, lng: 30.06 } }))).toBe(false);
    expect(isProbableDuplicate(r, a, herd())).toBe(true);
  });

  it('returns candidates newest first, without the fiche itself, honouring sameCollectorOnly', () => {
    const rows = [
      { id: 'a', data: herd(), submittedBy: 'u1', submittedAt: '2026-11-14T08:00:00Z' },
      { id: 'b', data: herd(), submittedBy: 'u2', submittedAt: '2026-11-15T08:00:00Z' },
      { id: 'c', data: herd({ goats_count: 3 }), submittedBy: 'u1', submittedAt: '2026-11-16T08:00:00Z' },
    ];
    expect(matchCandidates(rule, herd(), rows, { excludeId: 'a' }).map((r) => r.id)).toEqual(['b']);
    expect(matchCandidates(rule, herd(), rows).map((r) => r.id)).toEqual(['b', 'a']);
    expect(matchCandidates({ ...rule, sameCollectorOnly: true }, herd(), rows, { submittedBy: 'u1' }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('clusterDuplicates', () => {
  it('groups probable duplicates transitively and leaves singletons out', () => {
    const r = parseRule(schema({ ...DM_RULE, tolerances: { goats_count: 1 } }))!;
    const rows = ['150', 151, 152, 40].map((g, i) => ({ id: `r${i}`, data: herd({ goats_count: g }), submittedBy: 'u', submittedAt: '2026-11-16T00:00:00Z' }));
    expect(clusterDuplicates(r, rows)).toEqual([['r0', 'r1', 'r2']]);
  });
});

describe('helpers', () => {
  it('finds the deepest admin level', () => {
    expect(adminLeaf({ level_0: 'RW', level_2: 'd', level_5: 'v' })).toEqual({ level: 'level_5', id: 'v' });
    expect(adminLeaf({ level_0: 'RW', level_1: 'p', level_2: '' })).toEqual({ level: 'level_1', id: 'p' });
    expect(adminLeaf(null)).toBeNull();
  });

  it('builds a key-order independent JSON', () => {
    expect(stableJson({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: null } })).toBe(stableJson({ a: { c: null, d: [2, { x: 0, y: 1 }] }, b: 1 }));
  });
});
