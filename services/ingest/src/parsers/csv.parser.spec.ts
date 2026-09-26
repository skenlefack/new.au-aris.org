import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv.parser';

describe('parseCsv', () => {
  it('parses comma-separated CSV', async () => {
    const csv = 'name,age,country\nAlice,30,Kenya\nBob,25,Ethiopia\n';
    const result = await parseCsv(Buffer.from(csv));
    expect(result.headers).toEqual(['name', 'age', 'country']);
    expect(result.dataRows).toHaveLength(2);
    expect(result.dataRows[0]).toEqual(['Alice', '30', 'Kenya']);
    expect(result.delimiter).toBe(',');
  });

  it('parses semicolon-separated CSV (latin-1 style)', async () => {
    const csv = 'nom;age;pays\nAlice;30;Kenya\nBob;25;Ethiopie\n';
    const result = await parseCsv(Buffer.from(csv));
    expect(result.headers).toEqual(['nom', 'age', 'pays']);
    expect(result.dataRows).toHaveLength(2);
    expect(result.delimiter).toBe(';');
  });

  it('parses tab-separated values', async () => {
    const csv = 'name\tage\ncountry\nAlice\t30\nKenya\n';
    // Tab wins if it appears more than comma
    const result = await parseCsv(Buffer.from('name\tage\tpays\nAlice\t30\tKenya\n'));
    expect(result.headers).toEqual(['name', 'age', 'pays']);
    expect(result.delimiter).toBe('\t');
  });

  it('detects header row (first non-numeric row)', async () => {
    const csv = 'name,age\nAlice,30\nBob,25\n';
    const result = await parseCsv(Buffer.from(csv));
    expect(result.headerRow).toBe(0);
  });

  it('handles empty file', async () => {
    const result = await parseCsv(Buffer.from(''));
    expect(result.headers).toEqual([]);
    expect(result.dataRows).toHaveLength(0);
  });

  it('handles BOM', async () => {
    const csv = '\uFEFFname,age\nAlice,30\n';
    const result = await parseCsv(Buffer.from(csv));
    expect(result.headers).toEqual(['name', 'age']);
  });
});
