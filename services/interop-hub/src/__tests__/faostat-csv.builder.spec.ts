import { describe, it, expect } from 'vitest';
import { buildFaostatCsv } from '../services/faostat-csv.builder';
import type { FaostatCsvRow } from '../services/faostat-csv.builder';

describe('buildFaostatCsv', () => {
  const sampleRows: FaostatCsvRow[] = [
    { area: 'Kenya', item: 'Cattle', element: 'Stocks', unit: 'Head', year: 2024, value: 18000000 },
    { area: 'Kenya', item: 'Sheep', element: 'Stocks', unit: 'Head', year: 2024, value: 17000000 },
    { area: 'Ethiopia', item: 'Cattle', element: 'Stocks', unit: 'Head', year: 2024, value: 65000000 },
  ];

  it('should start with UTF-8 BOM', () => {
    const csv = buildFaostatCsv(sampleRows);

    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('should include header row with correct columns', () => {
    const csv = buildFaostatCsv(sampleRows);
    const lines = csv.replace('\uFEFF', '').split('\r\n');

    expect(lines[0]).toBe('Area,Item,Element,Unit,Year,Value');
  });

  it('should include all data rows', () => {
    const csv = buildFaostatCsv(sampleRows);
    const lines = csv.replace('\uFEFF', '').split('\r\n').filter(Boolean);

    // 1 header + 3 data rows
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('Kenya,Cattle,Stocks,Head,2024,18000000');
    expect(lines[2]).toBe('Kenya,Sheep,Stocks,Head,2024,17000000');
    expect(lines[3]).toBe('Ethiopia,Cattle,Stocks,Head,2024,65000000');
  });

  it('should handle empty rows array', () => {
    const csv = buildFaostatCsv([]);
    const lines = csv.replace('\uFEFF', '').split('\r\n').filter(Boolean);

    // Only header row
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Area,Item,Element,Unit,Year,Value');
  });

  it('should quote fields containing commas', () => {
    const rowsWithComma: FaostatCsvRow[] = [
      { area: "Cote d'Ivoire", item: 'Cattle, domestic', element: 'Stocks', unit: 'Head', year: 2024, value: 1500000 },
    ];

    const csv = buildFaostatCsv(rowsWithComma);
    const lines = csv.replace('\uFEFF', '').split('\r\n').filter(Boolean);

    expect(lines[1]).toContain('"Cattle, domestic"');
  });

  it('should escape double-quotes by doubling them', () => {
    const rowsWithQuote: FaostatCsvRow[] = [
      { area: 'Kenya', item: 'Cattle "Bos taurus"', element: 'Stocks', unit: 'Head', year: 2024, value: 5000000 },
    ];

    const csv = buildFaostatCsv(rowsWithQuote);

    expect(csv).toContain('"Cattle ""Bos taurus"""');
  });

  it('should use CRLF line endings', () => {
    const csv = buildFaostatCsv(sampleRows);
    const content = csv.replace('\uFEFF', '');

    // Each line except the last has \r\n
    expect(content).toContain('\r\n');
    // Should not have bare \n without preceding \r
    const withoutCRLF = content.replace(/\r\n/g, '');
    expect(withoutCRLF).not.toContain('\n');
  });

  it('should end with a trailing CRLF', () => {
    const csv = buildFaostatCsv(sampleRows);

    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('should produce valid CSV for single row', () => {
    const singleRow: FaostatCsvRow[] = [
      { area: 'Nigeria', item: 'Goat', element: 'Production', unit: 'tonnes', year: 2023, value: 250000 },
    ];

    const csv = buildFaostatCsv(singleRow);
    const lines = csv.replace('\uFEFF', '').split('\r\n').filter(Boolean);

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Nigeria,Goat,Production,tonnes,2023,250000');
  });

  it('should handle area names without needing quoting', () => {
    const csv = buildFaostatCsv(sampleRows);

    // Simple area names should not be quoted
    expect(csv).toContain('\nKenya,Cattle');
  });
});
