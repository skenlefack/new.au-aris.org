import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { TemporalConsistencyGate } from '../temporal-consistency.gate';

describe('TemporalConsistencyGate', () => {
  const gate = new TemporalConsistencyGate();

  it('should PASS when dates are in correct order', () => {
    const record = {
      suspicionDate: '2024-01-01',
      confirmationDate: '2024-01-15',
      closureDate: '2024-02-01',
    };
    const result = gate.execute(record, {
      temporalPairs: [
        ['suspicionDate', 'confirmationDate'],
        ['confirmationDate', 'closureDate'],
      ],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
    expect(result.violations).toHaveLength(0);
  });

  it('should FAIL when later date is before earlier date', () => {
    const record = {
      suspicionDate: '2024-03-01',
      confirmationDate: '2024-01-15',
    };
    const result = gate.execute(record, {
      temporalPairs: [['suspicionDate', 'confirmationDate']],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('confirmationDate');
  });

  it('should PASS when dates are equal (same day)', () => {
    const record = {
      suspicionDate: '2024-01-01',
      confirmationDate: '2024-01-01',
    };
    const result = gate.execute(record, {
      temporalPairs: [['suspicionDate', 'confirmationDate']],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should skip pair when one date is null', () => {
    const record = { suspicionDate: '2024-01-01', confirmationDate: null };
    const result = gate.execute(record, {
      temporalPairs: [['suspicionDate', 'confirmationDate']],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
    expect(result.violations).toHaveLength(0);
  });

  it('should FAIL on invalid date strings', () => {
    const record = { suspicionDate: 'not-a-date', confirmationDate: '2024-01-15' };
    const result = gate.execute(record, {
      temporalPairs: [['suspicionDate', 'confirmationDate']],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('not a valid date');
  });

  it('should SKIP when no temporal pairs configured', () => {
    const result = gate.execute({ a: 1 }, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });
});
