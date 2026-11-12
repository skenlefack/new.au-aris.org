import { describe, it, expect } from 'vitest';
import { checkSubmission, computeStats, type SchemaLike, type GeoEntityInfo, type CheckContext } from './consistency-rules';
import { isInsideCountry } from './country-bounds';

const schema: SchemaLike = {
  settings: { requireGeoLocation: false },
  sections: [{
    fields: [
      { code: 'admin_location', type: 'admin-location', required: true, label: { en: 'Location' } },
      { code: 'geo_location', type: 'geo-selector', label: { en: 'GPS' } },
      { code: 'goats_count', type: 'number', required: true, validation: { min: 0 }, label: { en: 'Goats' } },
      { code: 'sheep_count', type: 'number', required: true, validation: { min: 0 }, label: { en: 'Sheep' } },
      { code: 'animals_affected', type: 'number', validation: { min: 0 } },
      { code: 'animals_died', type: 'number', validation: { min: 0 } },
      { code: 'clinical_signs', type: 'multi-select', properties: { options: [{ value: 'fever' }, { value: 'diarrhea' }] } },
      { code: 'first_case_date', type: 'date' },
      { code: 'vaccinated_ppr', type: 'select', required: true, properties: { options: [{ value: 'yes' }, { value: 'no' }] } },
      { code: 'vaccination_date', type: 'date' },
      { code: 'animals_move', type: 'select', properties: { options: [{ value: 'yes' }, { value: 'no' }] } },
      { code: 'animal_movements', type: 'repeater', conditions: [{ type: 'visibility', action: 'show', logic: 'all', rules: [{ field: 'animals_move', operator: 'equals', value: 'yes' }] }] },
      { code: 'biosecurity_measures', type: 'multi-select', properties: { options: [{ value: 'isolation' }, { value: 'none' }] } },
    ],
  }],
};

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const geo = new Map<string, GeoEntityInfo>([
  [D1, { id: D1, parentId: null, level: 'ADMIN1', name: 'Pader', countryCode: 'UG' }],
  [D2, { id: D2, parentId: D1, level: 'ADMIN2', name: 'Aruu', countryCode: 'UG' }],
  [OTHER, { id: OTHER, parentId: 'x', level: 'ADMIN2', name: 'Elsewhere', countryCode: 'UG' }],
]);

const good = {
  admin_location: { level_0: 'UG', level_1: D1, level_2: D2 },
  geo_location: { lat: 2.9, lng: 33.0 },
  goats_count: 20, sheep_count: 5,
  animals_affected: 4, animals_died: 1,
  clinical_signs: ['fever'],
  first_case_date: '2026-09-01',
  vaccinated_ppr: 'yes', vaccination_date: '2026-03-01',
  animals_move: 'no',
  biosecurity_measures: ['isolation'],
};

function run(data: Record<string, unknown>, extra: Partial<CheckContext> = {}) {
  return checkSubmission({ data, schema, submittedAt: new Date('2026-10-05T10:00:00Z'), countryCode: 'UG', geo, ...extra });
}
const codes = (data: Record<string, unknown>, extra: Partial<CheckContext> = {}) => run(data, extra).map((i) => i.code);

describe('checkSubmission', () => {
  it('finds nothing on a coherent submission', () => {
    expect(run(good)).toEqual([]);
  });

  it('flags more deaths or sick animals than animals in the herd', () => {
    expect(codes({ ...good, goats_count: 10, sheep_count: 5, animals_died: 20, animals_affected: 20 })).toEqual(
      expect.arrayContaining(['DEATHS_EXCEED_POPULATION', 'AFFECTED_EXCEED_POPULATION']),
    );
    expect(codes({ ...good, animals_affected: 3, animals_died: 4 })).toContain('DEATHS_EXCEED_AFFECTED');
  });

  it('flags a date after the submission date', () => {
    const i = run({ ...good, first_case_date: '2026-10-16' }).find((x) => x.code === 'DATE_AFTER_SUBMISSION');
    expect(i?.severity).toBe('error');
    expect(i?.fields).toEqual(['first_case_date']);
  });

  it('flags missing required fields and negative numbers', () => {
    expect(codes({ ...good, vaccinated_ppr: '' })).toContain('REQUIRED_MISSING');
    expect(codes({ ...good, goats_count: -3 })).toContain('BELOW_MIN');
  });

  it('flags GPS outside the country and proposes the swap when lat/lng are inverted', () => {
    const out = run({ ...good, geo_location: { lat: 33.2145, lng: 33.2145 } }).find((x) => x.code === 'GPS_OUTSIDE_COUNTRY');
    expect(out).toBeDefined();
    expect(out?.suggestion).toBeUndefined();
    const swapped = run({ ...good, geo_location: { lat: 32.4, lng: 0.3 } }).find((x) => x.code === 'GPS_OUTSIDE_COUNTRY');
    expect(swapped?.suggestion?.value).toEqual({ lat: 0.3, lng: 32.4 });
  });

  it('flags admin areas that no longer exist and carries the neighbour suggestion', () => {
    const stale = { ...good, admin_location: { level_0: 'UG', level_1: '99999999-9999-4999-8999-999999999999', level_2: D2 } };
    const sug = { value: { level_0: 'UG', level_1: D1, level_2: D2 }, names: ['Pader', 'Aruu'], distanceKm: 1.2 };
    const i = run(stale, { adminSuggestions: new Map([['admin_location', sug]]) }).find((x) => x.code === 'UNKNOWN_ADMIN_AREA');
    expect(i?.severity).toBe('error');
    expect(i?.suggestion).toMatchObject({ field: 'admin_location', value: sug.value, approximate: true, label: 'Pader / Aruu' });
  });

  it('flags an area that is not inside its parent', () => {
    expect(codes({ ...good, admin_location: { level_0: 'UG', level_1: D1, level_2: OTHER } })).toContain('AREA_HIERARCHY_MISMATCH');
  });

  it('flags contradictions between answers', () => {
    expect(codes({ ...good, vaccinated_ppr: 'no' })).toContain('VACCINATION_CONTRADICTION');
    expect(codes({ ...good, animals_affected: null, animals_died: null })).toContain('SIGNS_WITHOUT_SICK_ANIMALS');
    const none = run({ ...good, biosecurity_measures: ['none', 'isolation'] }).find((x) => x.code === 'NONE_WITH_OTHERS');
    expect(none?.suggestion?.value).toEqual(['isolation']);
    const hidden = run({ ...good, animals_move: 'no', animal_movements: [{ a: 1 }] }).find((x) => x.code === 'HIDDEN_FIELD_FILLED');
    expect(hidden?.suggestion).toEqual({ field: 'animal_movements', value: null });
  });

  it('reports duplicates and extreme values only as hints', () => {
    const stats = new Map([['sheep_count', computeStats(Array.from({ length: 100 }, (_, i) => i % 10))]]);
    const r = run({ ...good, sheep_count: 600 }, { stats, duplicateIds: ['abc'] });
    expect(r.find((x) => x.code === 'UNUSUALLY_HIGH')?.severity).toBe('info');
    expect(r.find((x) => x.code === 'DUPLICATE')?.severity).toBe('warning');
    expect(run({ ...good, sheep_count: 9 }, { stats }).find((x) => x.code === 'UNUSUALLY_HIGH')).toBeUndefined();
  });

  it('sorts errors first', () => {
    const r = run({ ...good, geo_location: null, goats_count: 1, sheep_count: 0, animals_died: 5 });
    expect(r[0].severity).toBe('error');
    expect(r[r.length - 1].severity).toBe('info');
  });
});

describe('country bounds', () => {
  it('knows Uganda and rejects a point in Tanzania', () => {
    expect(isInsideCountry('UG', 0.35, 32.58)).toBe(true);
    expect(isInsideCountry('UG', -2.26, 31.83)).toBe(false);
    expect(isInsideCountry('XX', 0, 0)).toBeNull();
  });
});
