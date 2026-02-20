import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { CompletenessGate } from '../completeness.gate';

describe('CompletenessGate', () => {
  const gate = new CompletenessGate();

  it('should PASS when all required fields are present', () => {
    const record = { name: 'Test', speciesCode: 'BOV', countryCode: 'KE' };
    const result = gate.execute(record, {
      requiredFields: ['name', 'speciesCode', 'countryCode'],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
    expect(result.violations).toHaveLength(0);
  });

  it('should FAIL when required fields are missing', () => {
    const record = { name: 'Test' };
    const result = gate.execute(record, {
      requiredFields: ['name', 'speciesCode', 'countryCode'],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].field).toBe('speciesCode');
    expect(result.violations[1].field).toBe('countryCode');
  });

  it('should FAIL when required fields are null or empty string', () => {
    const record = { name: null, code: '' };
    const result = gate.execute(record, {
      requiredFields: ['name', 'code'],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations).toHaveLength(2);
  });

  it('should support nested field paths', () => {
    const record = { geo: { countryCode: 'KE' }, name: 'Test' };
    const result = gate.execute(record, {
      requiredFields: ['name', 'geo.countryCode', 'geo.adminCode'],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('geo.adminCode');
  });

  it('should SKIP when no required fields configured', () => {
    const record = { name: 'Test' };
    const result = gate.execute(record, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });
});
