import { describe, it, expect } from 'vitest';
import {
  parseDate,
  parseNumber,
  applyTransformations,
  computeIdempotencyKey,
  transformRow,
} from './transformer.service';

describe('parseDate', () => {
  it('parses ISO format', () => {
    expect(parseDate('2024-01-15')).toBe('2024-01-15');
  });

  it('parses DD/MM/YYYY', () => {
    expect(parseDate('15/01/2024')).toBe('2024-01-15');
  });

  it('parses DD-MM-YYYY', () => {
    expect(parseDate('15-01-2024')).toBe('2024-01-15');
  });

  it('parses DD.MM.YYYY', () => {
    expect(parseDate('15.01.2024')).toBe('2024-01-15');
  });

  it('parses YYYY/MM/DD', () => {
    expect(parseDate('2024/01/15')).toBe('2024-01-15');
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('returns null for unparseable date', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('handles ISO with time component', () => {
    expect(parseDate('2024-01-15T10:30:00Z')).toBe('2024-01-15');
  });
});

describe('parseNumber', () => {
  it('parses integer', () => {
    expect(parseNumber('42')).toBe(42);
  });

  it('parses decimal with dot', () => {
    expect(parseNumber('3.14')).toBe(3.14);
  });

  it('parses decimal with comma (European)', () => {
    expect(parseNumber('3,14')).toBe(3.14);
  });

  it('handles whitespace', () => {
    expect(parseNumber(' 42 ')).toBe(42);
  });

  it('returns null for empty', () => {
    expect(parseNumber('')).toBeNull();
  });

  it('returns null for non-numeric', () => {
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('applyTransformations', () => {
  it('trims whitespace', () => {
    expect(applyTransformations('  hello  ', [{ type: 'trim' }])).toBe('hello');
  });

  it('applies date format', () => {
    expect(applyTransformations('15/01/2024', [{ type: 'date_format' }])).toBe('2024-01-15');
  });

  it('applies number parse', () => {
    expect(applyTransformations('3,14', [{ type: 'number_parse' }])).toBe(3.14);
  });

  it('applies constant', () => {
    expect(applyTransformations('anything', [{ type: 'constant', params: { value: 'FIXED' } }])).toBe('FIXED');
  });

  it('applies split', () => {
    expect(applyTransformations('a;b;c', [{ type: 'split', params: { separator: ';', index: 1 } }])).toBe('b');
  });

  it('applies unit conversion', () => {
    expect(applyTransformations('100', [{ type: 'unit_convert', params: { factor: 0.001 } }])).toBeCloseTo(0.1);
  });

  it('chains multiple transformations', () => {
    expect(applyTransformations('  15/01/2024  ', [{ type: 'trim' }, { type: 'date_format' }])).toBe('2024-01-15');
  });
});

describe('computeIdempotencyKey', () => {
  it('produces consistent key for same data', () => {
    const k1 = computeIdempotencyKey('c1', 't1', { a: '1', b: '2' });
    const k2 = computeIdempotencyKey('c1', 't1', { a: '1', b: '2' });
    expect(k1).toBe(k2);
    expect(k1).toHaveLength(32);
  });

  it('produces different key for different data', () => {
    const k1 = computeIdempotencyKey('c1', 't1', { a: '1' });
    const k2 = computeIdempotencyKey('c1', 't1', { a: '2' });
    expect(k1).not.toBe(k2);
  });

  it('produces different key for different campaign', () => {
    const k1 = computeIdempotencyKey('c1', 't1', { a: '1' });
    const k2 = computeIdempotencyKey('c2', 't1', { a: '1' });
    expect(k1).not.toBe(k2);
  });

  it('uses key fields when provided', () => {
    const k1 = computeIdempotencyKey('c1', 't1', { a: '1', b: '2', c: '3' }, ['a', 'b']);
    const k2 = computeIdempotencyKey('c1', 't1', { a: '1', b: '2', c: '999' }, ['a', 'b']);
    expect(k1).toBe(k2); // c is not a key field
  });
});

describe('transformRow', () => {
  it('maps source columns to target fields', () => {
    const result = transformRow(
      ['Alice', '30', 'Kenya'],
      ['name', 'age', 'country'],
      [
        { sourceColumn: 'name', targetFieldCode: 'full_name' },
        { sourceColumn: 'age', targetFieldCode: 'user_age' },
      ],
    );
    expect(result).toEqual({ full_name: 'Alice', user_age: '30' });
  });

  it('applies transformations', () => {
    const result = transformRow(
      ['15/01/2024'],
      ['date'],
      [{ sourceColumn: 'date', targetFieldCode: 'event_date', transformation: { type: 'date_format' } }],
    );
    expect(result).toEqual({ event_date: '2024-01-15' });
  });

  it('skips empty values', () => {
    const result = transformRow(
      ['', 'value'],
      ['a', 'b'],
      [
        { sourceColumn: 'a', targetFieldCode: 'x' },
        { sourceColumn: 'b', targetFieldCode: 'y' },
      ],
    );
    expect(result).toEqual({ y: 'value' });
  });

  it('handles missing source column gracefully', () => {
    const result = transformRow(
      ['value'],
      ['col1'],
      [{ sourceColumn: 'nonexistent', targetFieldCode: 'target' }],
    );
    expect(result).toEqual({});
  });
});
