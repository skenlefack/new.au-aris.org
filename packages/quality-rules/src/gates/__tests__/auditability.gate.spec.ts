import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { AuditabilityGate } from '../auditability.gate';

describe('AuditabilityGate', () => {
  const gate = new AuditabilityGate();

  it('should PASS when all default audit fields are present', () => {
    const record = {
      sourceSystem: 'ARIS',
      responsibleUnit: 'CVO-KE',
      validationStatus: 'DRAFT',
    };
    const result = gate.execute(record, {});
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should FAIL when default audit fields are missing', () => {
    const record = { sourceSystem: 'ARIS' };
    const result = gate.execute(record, {});
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations).toHaveLength(2);
    const fields = result.violations.map((v) => v.field);
    expect(fields).toContain('responsibleUnit');
    expect(fields).toContain('validationStatus');
  });

  it('should use custom audit fields when provided', () => {
    const record = { createdBy: 'user-1', tenantId: 'tenant-ke' };
    const result = gate.execute(record, {
      auditFields: ['createdBy', 'tenantId', 'dataClassification'],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('dataClassification');
  });

  it('should FAIL on empty string values', () => {
    const record = {
      sourceSystem: '',
      responsibleUnit: 'CVO-KE',
      validationStatus: 'DRAFT',
    };
    const result = gate.execute(record, {});
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].field).toBe('sourceSystem');
  });
});
