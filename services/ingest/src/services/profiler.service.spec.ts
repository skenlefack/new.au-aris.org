import { describe, it, expect } from 'vitest';
import { profileColumns, computeStructureHash, normalizeName } from './profiler.service';
import type { ParsedSheet } from '../parsers/types';

function makeSheet(headers: string[], rows: string[][]): ParsedSheet {
  return { sheetIndex: 0, sheetName: 'test', headerRow: 0, headers, dataRows: rows };
}

describe('normalizeName', () => {
  it('lowercases and replaces spaces', () => {
    expect(normalizeName('Animal Species')).toBe('animal_species');
  });

  it('removes special characters', () => {
    expect(normalizeName('Col #1 (ID)')).toBe('col_1_id');
  });

  it('trims underscores', () => {
    expect(normalizeName('  _name_ ')).toBe('name');
  });

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });
});

describe('profileColumns', () => {
  it('detects text columns', () => {
    const sheet = makeSheet(['name'], [['Alice'], ['Bob'], ['Charlie']]);
    const stats = profileColumns(sheet);
    expect(stats).toHaveLength(1);
    expect(stats[0].inferredType).toBe('text');
    expect(stats[0].cardinality).toBe(3);
    expect(stats[0].nullRate).toBe(0);
  });

  it('detects integer columns', () => {
    const sheet = makeSheet(['count'], [['10'], ['20'], ['30'], ['40']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('integer');
  });

  it('detects decimal columns with comma separator', () => {
    const sheet = makeSheet(['value'], [['10,5'], ['20,3'], ['30,1']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('decimal');
  });

  it('detects date columns (ISO format)', () => {
    const sheet = makeSheet(['date'], [['2024-01-15'], ['2024-02-20'], ['2024-03-10']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('date');
  });

  it('detects date columns (DD/MM/YYYY)', () => {
    const sheet = makeSheet(['date'], [['15/01/2024'], ['20/02/2024'], ['10/03/2024']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('date');
  });

  it('detects mixed date formats', () => {
    const sheet = makeSheet(['date'], [['2024-01-15'], ['15/01/2024'], ['10-03-2024']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('date');
    expect(stats[0].detectedPatterns).toContain('mixed_date_formats');
  });

  it('detects boolean columns', () => {
    const sheet = makeSheet(['active'], [['yes'], ['no'], ['yes'], ['no']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('boolean');
  });

  it('detects email columns', () => {
    const sheet = makeSheet(['email'], [['a@b.com'], ['c@d.org'], ['e@f.net']]);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('email');
  });

  it('detects select/enum columns (low cardinality)', () => {
    const values = Array.from({ length: 50 }, (_, i) => [i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low']);
    const sheet = makeSheet(['risk'], values);
    const stats = profileColumns(sheet);
    expect(stats[0].inferredType).toBe('select');
    expect(stats[0].cardinality).toBe(3);
  });

  it('computes null rate correctly', () => {
    const sheet = makeSheet(['value'], [['a'], [''], ['c'], ['']]);
    const stats = profileColumns(sheet);
    expect(stats[0].nullRate).toBe(0.5);
  });

  it('provides sample values (max 5)', () => {
    const rows = Array.from({ length: 20 }, (_, i) => [`val_${i}`]);
    const sheet = makeSheet(['col'], rows);
    const stats = profileColumns(sheet);
    expect(stats[0].sampleValues.length).toBeLessThanOrEqual(5);
  });
});

describe('computeStructureHash', () => {
  it('produces consistent hash for same structure', () => {
    const cols = [
      { rawName: 'A', normalizedName: 'a', inferredType: 'text', cardinality: 1, nullRate: 0, minLength: 1, maxLength: 1, sampleValues: [], detectedPatterns: [] },
    ];
    const h1 = computeStructureHash(cols);
    const h2 = computeStructureHash(cols);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('produces different hash for different structure', () => {
    const cols1 = [
      { rawName: 'A', normalizedName: 'a', inferredType: 'text', cardinality: 1, nullRate: 0, minLength: 1, maxLength: 1, sampleValues: [], detectedPatterns: [] },
    ];
    const cols2 = [
      { rawName: 'B', normalizedName: 'b', inferredType: 'integer', cardinality: 1, nullRate: 0, minLength: 1, maxLength: 1, sampleValues: [], detectedPatterns: [] },
    ];
    expect(computeStructureHash(cols1)).not.toBe(computeStructureHash(cols2));
  });
});
