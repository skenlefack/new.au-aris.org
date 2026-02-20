import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  toCsv,
  validateGeoRow,
  validateSpeciesRow,
  validateDiseaseRow,
  validateUnitRow,
  validateIdentifierRow,
  validateDenominatorRow,
} from './csv-parser.util';

describe('parseCsv', () => {
  it('should parse a simple CSV with headers and rows', () => {
    const csv = 'code,name,level\nKE,Kenya,COUNTRY\nET,Ethiopia,COUNTRY';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['code', 'name', 'level']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ code: 'KE', name: 'Kenya', level: 'COUNTRY' });
    expect(result.rows[1]).toEqual({ code: 'ET', name: 'Ethiopia', level: 'COUNTRY' });
    expect(result.errors).toHaveLength(0);
  });

  it('should handle CRLF line endings', () => {
    const csv = 'code,name\r\nKE,Kenya\r\nET,Ethiopia';
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['code']).toBe('KE');
  });

  it('should handle quoted fields with commas', () => {
    const csv = 'code,name\nKE,"Kenya, Republic of"';
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['name']).toBe('Kenya, Republic of');
  });

  it('should handle escaped quotes within quoted fields', () => {
    const csv = 'code,name\nCI,"Côte d""Ivoire"';
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['name']).toBe('Côte d"Ivoire');
  });

  it('should skip empty lines', () => {
    const csv = 'code,name\nKE,Kenya\n\nET,Ethiopia\n';
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
  });

  it('should report error for column count mismatch', () => {
    const csv = 'code,name,level\nKE,Kenya\nET,Ethiopia,COUNTRY';
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].message).toContain('Expected 3 columns, got 2');
  });

  it('should return error for empty CSV', () => {
    const result = parseCsv('');

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Empty CSV');
  });

  it('should trim header and value whitespace', () => {
    const csv = ' code , name \n KE , Kenya ';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['code', 'name']);
    expect(result.rows[0]['code']).toBe('KE');
    expect(result.rows[0]['name']).toBe('Kenya');
  });

  it('should lowercase headers', () => {
    const csv = 'Code,Name_En,LEVEL\nKE,Kenya,COUNTRY';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['code', 'name_en', 'level']);
  });
});

describe('toCsv', () => {
  it('should produce valid CSV from headers and rows', () => {
    const headers = ['code', 'name'];
    const rows = [{ code: 'KE', name: 'Kenya' }, { code: 'ET', name: 'Ethiopia' }];
    const csv = toCsv(headers, rows);

    expect(csv).toBe('code,name\nKE,Kenya\nET,Ethiopia');
  });

  it('should escape fields containing commas', () => {
    const csv = toCsv(['name'], [{ name: 'Kenya, Republic' }]);
    expect(csv).toContain('"Kenya, Republic"');
  });

  it('should escape fields containing quotes', () => {
    const csv = toCsv(['name'], [{ name: 'Côte d"Ivoire' }]);
    expect(csv).toContain('"Côte d""Ivoire"');
  });

  it('should handle null and undefined values', () => {
    const csv = toCsv(['a', 'b'], [{ a: null, b: undefined }]);
    expect(csv).toBe('a,b\n,');
  });
});

describe('validateGeoRow', () => {
  const validRow = {
    code: 'KE', name: 'Kenya', name_en: 'Kenya', name_fr: 'Kenya',
    level: 'COUNTRY', country_code: 'KE',
  };

  it('should accept a valid geo row', () => {
    const result = validateGeoRow(validRow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing required fields', () => {
    const result = validateGeoRow({ code: 'KE', name: '', name_en: '', name_fr: '', level: '', country_code: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('should reject invalid level', () => {
    const result = validateGeoRow({ ...validRow, level: 'INVALID' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('level'))).toBe(true);
  });
});

describe('validateSpeciesRow', () => {
  const validRow = {
    code: 'BOS-TAU', scientific_name: 'Bos taurus',
    common_name_en: 'Cattle', common_name_fr: 'Bovin', category: 'DOMESTIC',
  };

  it('should accept a valid species row', () => {
    expect(validateSpeciesRow(validRow).valid).toBe(true);
  });

  it('should reject missing scientific_name', () => {
    const result = validateSpeciesRow({ ...validRow, scientific_name: '' });
    expect(result.valid).toBe(false);
  });

  it('should reject invalid category', () => {
    const result = validateSpeciesRow({ ...validRow, category: 'BIRD' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('category'))).toBe(true);
  });
});

describe('validateDiseaseRow', () => {
  it('should accept a valid disease row', () => {
    const result = validateDiseaseRow({ code: 'FMD', name_en: 'Foot and mouth', name_fr: 'Fièvre aphteuse' });
    expect(result.valid).toBe(true);
  });

  it('should reject missing name_en', () => {
    const result = validateDiseaseRow({ code: 'FMD', name_en: '', name_fr: 'Fièvre aphteuse' });
    expect(result.valid).toBe(false);
  });
});

describe('validateUnitRow', () => {
  it('should accept a valid unit row', () => {
    const result = validateUnitRow({
      code: 'KG', name_en: 'Kilogram', name_fr: 'Kilogramme',
      symbol: 'kg', category: 'WEIGHT',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid category', () => {
    const result = validateUnitRow({
      code: 'KG', name_en: 'Kilogram', name_fr: 'Kilogramme',
      symbol: 'kg', category: 'INVALID',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateIdentifierRow', () => {
  it('should accept a valid identifier row', () => {
    const result = validateIdentifierRow({
      code: 'LAB-KE-001', name_en: 'Kabete Lab', name_fr: 'Labo Kabete', type: 'LAB',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid type', () => {
    const result = validateIdentifierRow({
      code: 'X', name_en: 'X', name_fr: 'X', type: 'HOSPITAL',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateDenominatorRow', () => {
  const validRow = {
    country_code: 'KE', species_code: 'BOS-TAU', year: '2023',
    source: 'FAOSTAT', population: '19400000',
  };

  it('should accept a valid denominator row', () => {
    expect(validateDenominatorRow(validRow).valid).toBe(true);
  });

  it('should reject non-numeric year', () => {
    const result = validateDenominatorRow({ ...validRow, year: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('year'))).toBe(true);
  });

  it('should reject non-numeric population', () => {
    const result = validateDenominatorRow({ ...validRow, population: 'many' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('population'))).toBe(true);
  });

  it('should reject invalid source', () => {
    const result = validateDenominatorRow({ ...validRow, source: 'WORLDBANK' });
    expect(result.valid).toBe(false);
  });
});
