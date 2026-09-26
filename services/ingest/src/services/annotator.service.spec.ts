import { describe, it, expect } from 'vitest';
import { annotateViaLexical } from './annotator.service';

describe('annotateViaLexical', () => {
  it('matches exact alias', () => {
    const r = annotateViaLexical('species');
    expect(r.concept).toBe('species');
    expect(r.confidence).toBe(1.0);
    expect(r.method).toBe('LEXICAL');
  });

  it('matches French alias', () => {
    const r = annotateViaLexical('maladie');
    expect(r.concept).toBe('disease');
    expect(r.method).toBe('LEXICAL');
  });

  it('matches Portuguese alias', () => {
    const r = annotateViaLexical('pais');
    expect(r.concept).toBe('country');
  });

  it('matches compound name via substring', () => {
    const r = annotateViaLexical('observation_date');
    expect(r.concept).toBe('date');
  });

  it('returns NONE for unknown column', () => {
    const r = annotateViaLexical('xyzzy_unknown_col_42');
    expect(r.concept).toBeNull();
    expect(r.method).toBe('NONE');
  });

  it('matches lab-related columns', () => {
    const r = annotateViaLexical('laboratory');
    expect(r.concept).toBe('laboratory');
  });

  it('matches quantite alias', () => {
    const r = annotateViaLexical('quantite');
    expect(r.concept).toBe('quantity');
  });

  it('matches GPS-related columns', () => {
    const r = annotateViaLexical('gps_lat');
    expect(r.concept).toBe('latitude');
  });
});

describe('annotateViaLexical — form-generator integration', () => {
  it('recognizes common ARIS field names', () => {
    const fields = ['species', 'date', 'country', 'cases', 'deaths', 'vaccinated', 'population'];
    for (const field of fields) {
      const r = annotateViaLexical(field);
      expect(r.concept).not.toBeNull();
      expect(r.method).toBe('LEXICAL');
    }
  });
});
