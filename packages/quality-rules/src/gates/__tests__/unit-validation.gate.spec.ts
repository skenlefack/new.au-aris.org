import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { UnitValidationGate } from '../unit-validation.gate';

describe('UnitValidationGate', () => {
  const gate = new UnitValidationGate();

  it('should PASS when all unit codes are valid', () => {
    const record = { quantityUnit: 'HEAD', weightUnit: 'KG' };
    const result = gate.execute(record, {
      unitFields: ['quantityUnit', 'weightUnit'],
      validUnits: new Set(['HEAD', 'KG', 'DOSE', 'TONNE']),
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should FAIL when a unit code is invalid', () => {
    const record = { quantityUnit: 'INVALID_UNIT' };
    const result = gate.execute(record, {
      unitFields: ['quantityUnit'],
      validUnits: new Set(['HEAD', 'KG', 'DOSE']),
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('INVALID_UNIT');
  });

  it('should WARNING when no valid unit set is available', () => {
    const record = { quantityUnit: 'HEAD' };
    const result = gate.execute(record, {
      unitFields: ['quantityUnit'],
    });
    expect(result.result).toBe(QualityGateResult.WARNING);
    expect(result.violations[0].severity).toBe('WARNING');
  });

  it('should SKIP when no unit fields configured', () => {
    const result = gate.execute({ a: 1 }, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });
});
