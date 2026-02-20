import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { DeduplicationGate } from '../deduplication.gate';

describe('DeduplicationGate', () => {
  const gate = new DeduplicationGate();

  it('should FAIL on exact duplicate', () => {
    const record = { id: 'new', speciesCode: 'BOV', countryCode: 'KE', year: 2024 };
    const result = gate.execute(record, {
      dedupFields: ['speciesCode', 'countryCode', 'year'],
      existingRecords: [
        { id: 'existing-1', speciesCode: 'BOV', countryCode: 'KE', year: 2024 },
      ],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('Exact duplicate');
    expect(result.violations[0].message).toContain('existing-1');
  });

  it('should WARNING on fuzzy match above threshold', () => {
    const record = { id: 'new', name: 'Foot and mouth disease outbreak', region: 'Nairobi' };
    const result = gate.execute(record, {
      dedupFields: ['name', 'region'],
      existingRecords: [
        { id: 'existing-1', name: 'Foot and mouth disease outbreak', region: 'Nakuru' },
      ],
      fuzzyThreshold: 0.5,
    });
    // name is exact match, region differs — similarity should be high enough
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should PASS when no duplicates found', () => {
    const record = { id: 'new', speciesCode: 'BOV', countryCode: 'KE', year: 2024 };
    const result = gate.execute(record, {
      dedupFields: ['speciesCode', 'countryCode', 'year'],
      existingRecords: [
        { id: 'existing-1', speciesCode: 'OVI', countryCode: 'ET', year: 2023 },
      ],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should SKIP when no dedup fields or no existing records', () => {
    const result = gate.execute({ a: 1 }, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });

  it('should be case-insensitive for deterministic matching', () => {
    const record = { speciesCode: 'bov' };
    const result = gate.execute(record, {
      dedupFields: ['speciesCode'],
      existingRecords: [{ id: 'x', speciesCode: 'BOV' }],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
  });
});
