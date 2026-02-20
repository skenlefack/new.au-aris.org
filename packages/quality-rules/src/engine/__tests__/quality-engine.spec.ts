import { describe, it, expect } from 'vitest';
import { QualityGateResult, QualityGate } from '@aris/shared-types';
import { QualityEngine } from '../quality-engine';
import type { QualityGateConfig } from '../../interfaces/quality-report.interface';

describe('QualityEngine', () => {
  const engine = new QualityEngine();

  const FULL_CONFIG: QualityGateConfig = {
    requiredFields: ['id', 'speciesCode', 'countryCode', 'reportDate'],
    temporalPairs: [['suspicionDate', 'confirmationDate']],
    geoFields: ['countryCode'],
    validCodes: { geo: new Set(['KE', 'ET']), species: new Set(['BOV', 'OVI']) },
    coordinateFields: ['latitude', 'longitude'],
    codeFields: { speciesCode: 'species' },
    unitFields: ['quantityUnit'],
    validUnits: new Set(['HEAD', 'KG']),
    auditFields: ['sourceSystem', 'responsibleUnit', 'validationStatus'],
    confidenceLevelField: 'confidenceLevel',
    confidenceEvidenceFields: ['labResult'],
  };

  it('should PASS a fully valid record', () => {
    const record = {
      id: 'rec-001',
      speciesCode: 'BOV',
      countryCode: 'KE',
      reportDate: '2024-01-01',
      suspicionDate: '2024-01-01',
      confirmationDate: '2024-01-10',
      latitude: -1.28,
      longitude: 36.82,
      quantityUnit: 'HEAD',
      sourceSystem: 'ARIS',
      responsibleUnit: 'CVO-KE',
      validationStatus: 'DRAFT',
      confidenceLevel: 'CONFIRMED',
      labResult: 'POSITIVE',
    };

    const report = engine.check(record, 'Outbreak', FULL_CONFIG);

    expect(report.overallResult).toBe(QualityGateResult.PASS);
    expect(report.recordId).toBe('rec-001');
    expect(report.entityType).toBe('Outbreak');
    expect(report.gates).toHaveLength(8);
    expect(report.violations).toHaveLength(0);
    expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(report.checkedAt).toBeDefined();
  });

  it('should FAIL when any mandatory gate fails', () => {
    const record = {
      id: 'rec-002',
      // missing required fields: speciesCode, countryCode, reportDate
      sourceSystem: 'ARIS',
      responsibleUnit: 'CVO-KE',
      validationStatus: 'DRAFT',
      confidenceLevel: 'VERIFIED',
    };

    const report = engine.check(record, 'Outbreak', FULL_CONFIG);

    expect(report.overallResult).toBe(QualityGateResult.FAIL);
    expect(report.violations.length).toBeGreaterThan(0);

    // Completeness gate should have failed
    const completenessGate = report.gates.find(
      (g) => g.gate === QualityGate.COMPLETENESS,
    );
    expect(completenessGate?.result).toBe(QualityGateResult.FAIL);
  });

  it('should report WARNING as overall result when no FAIL but has warnings', () => {
    const record = {
      id: 'rec-003',
      speciesCode: 'BOV',
      countryCode: 'KE',
      reportDate: '2024-01-01',
      latitude: -1.28,
      longitude: 36.82,
      quantityUnit: 'HEAD',
      sourceSystem: 'ARIS',
      responsibleUnit: 'CVO-KE',
      validationStatus: 'DRAFT',
      confidenceLevel: 'RUMOR',
      labResult: 'POSITIVE', // all evidence present but RUMOR → warning
    };

    const report = engine.check(record, 'Outbreak', FULL_CONFIG);

    // Should be WARNING (confidence gate warns about RUMOR with evidence)
    expect(report.overallResult).toBe(QualityGateResult.WARNING);
  });

  it('should run all 8 gates and aggregate results', () => {
    const record = { id: 'rec-004' };
    const report = engine.check(record, 'Test', FULL_CONFIG);

    expect(report.gates).toHaveLength(8);

    const gateNames = report.gates.map((g) => g.gate);
    expect(gateNames).toContain(QualityGate.COMPLETENESS);
    expect(gateNames).toContain(QualityGate.TEMPORAL_CONSISTENCY);
    expect(gateNames).toContain(QualityGate.GEOGRAPHIC_CONSISTENCY);
    expect(gateNames).toContain(QualityGate.CODES_VOCABULARIES);
    expect(gateNames).toContain(QualityGate.UNITS);
    expect(gateNames).toContain(QualityGate.DEDUPLICATION);
    expect(gateNames).toContain(QualityGate.AUDITABILITY);
    expect(gateNames).toContain(QualityGate.CONFIDENCE_SCORE);
  });

  it('should flatten violations from all gates', () => {
    const record = { id: 'rec-005' }; // missing everything
    const report = engine.check(record, 'Test', FULL_CONFIG);

    // Violations should come from multiple gates
    const gatesWithViolations = new Set(report.violations.map((v) => v.gate));
    expect(gatesWithViolations.size).toBeGreaterThan(1);
  });
});
