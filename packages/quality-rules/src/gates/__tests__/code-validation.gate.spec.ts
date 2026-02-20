import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { CodeValidationGate } from '../code-validation.gate';

describe('CodeValidationGate', () => {
  const gate = new CodeValidationGate();

  it('should PASS when all codes exist in referential sets', () => {
    const record = { speciesCode: 'BOV', diseaseCode: 'FMD' };
    const result = gate.execute(record, {
      codeFields: { speciesCode: 'species', diseaseCode: 'disease' },
      validCodes: {
        species: new Set(['BOV', 'OVI', 'CAP']),
        disease: new Set(['FMD', 'ASF', 'HPAI']),
      },
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should FAIL when a code is not in the referential', () => {
    const record = { speciesCode: 'UNKNOWN_SPECIES' };
    const result = gate.execute(record, {
      codeFields: { speciesCode: 'species' },
      validCodes: { species: new Set(['BOV', 'OVI', 'CAP']) },
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('UNKNOWN_SPECIES');
  });

  it('should WARNING when code set is not available for a referential', () => {
    const record = { speciesCode: 'BOV' };
    const result = gate.execute(record, {
      codeFields: { speciesCode: 'species' },
      validCodes: {}, // no species set
    });
    expect(result.result).toBe(QualityGateResult.WARNING);
    expect(result.violations[0].severity).toBe('WARNING');
  });

  it('should SKIP when no code fields configured', () => {
    const result = gate.execute({ a: 1 }, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });

  it('should skip null code values (handled by completeness gate)', () => {
    const record = { speciesCode: null };
    const result = gate.execute(record, {
      codeFields: { speciesCode: 'species' },
      validCodes: { species: new Set(['BOV']) },
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });
});
