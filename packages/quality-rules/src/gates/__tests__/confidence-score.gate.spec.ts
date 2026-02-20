import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { ConfidenceScoreGate } from '../confidence-score.gate';

describe('ConfidenceScoreGate', () => {
  const gate = new ConfidenceScoreGate();

  it('should PASS when confidence level is valid and consistent with evidence', () => {
    const record = {
      confidenceLevel: 'CONFIRMED',
      labResult: 'POSITIVE',
      fieldInvestigation: true,
    };
    const result = gate.execute(record, {
      confidenceLevelField: 'confidenceLevel',
      confidenceEvidenceFields: ['labResult', 'fieldInvestigation'],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should FAIL when confidence level is missing', () => {
    const record = {};
    const result = gate.execute(record, {
      confidenceLevelField: 'confidenceLevel',
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('missing');
  });

  it('should FAIL when confidence level is invalid', () => {
    const record = { confidenceLevel: 'INVALID' };
    const result = gate.execute(record, {
      confidenceLevelField: 'confidenceLevel',
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('not valid');
  });

  it('should WARNING when CONFIRMED but no evidence', () => {
    const record = { confidenceLevel: 'CONFIRMED' };
    const result = gate.execute(record, {
      confidenceLevelField: 'confidenceLevel',
      confidenceEvidenceFields: ['labResult', 'fieldInvestigation'],
    });
    expect(result.result).toBe(QualityGateResult.WARNING);
    expect(result.violations[0].message).toContain('no evidence');
  });

  it('should WARNING when RUMOR but all evidence populated', () => {
    const record = {
      confidenceLevel: 'RUMOR',
      labResult: 'POSITIVE',
      fieldInvestigation: true,
    };
    const result = gate.execute(record, {
      confidenceLevelField: 'confidenceLevel',
      confidenceEvidenceFields: ['labResult', 'fieldInvestigation'],
    });
    expect(result.result).toBe(QualityGateResult.WARNING);
    expect(result.violations[0].message).toContain('consider upgrading');
  });

  it('should SKIP when no confidence level field configured', () => {
    const result = gate.execute({ a: 1 }, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });
});
