import { describe, it, expect } from 'vitest';
import { TransformEngine } from '../services/transform.engine.js';

describe('FHIR Resource Validation', () => {
  const engine = new TransformEngine();

  const fhirPatientSchema = {
    type: 'object',
    required: ['resourceType', 'id'],
    properties: {
      resourceType: { type: 'string', const: 'Patient' },
      id: { type: 'string' },
      active: { type: 'boolean' },
      identifier: {
        type: 'array',
        items: {
          type: 'object',
          required: ['system', 'value'],
          properties: {
            system: { type: 'string' },
            value: { type: 'string' },
          },
        },
      },
    },
  };

  const fhirObservationSchema = {
    type: 'object',
    required: ['resourceType', 'status', 'code'],
    properties: {
      resourceType: { type: 'string', const: 'Observation' },
      id: { type: 'string' },
      status: { type: 'string', enum: ['registered', 'preliminary', 'final', 'amended'] },
      code: {
        type: 'object',
        required: ['coding'],
        properties: {
          coding: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                system: { type: 'string' },
                code: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };

  const fhirDiagnosticReportSchema = {
    type: 'object',
    required: ['resourceType', 'status', 'code'],
    properties: {
      resourceType: { type: 'string', const: 'DiagnosticReport' },
      id: { type: 'string' },
      status: { type: 'string', enum: ['registered', 'partial', 'preliminary', 'final'] },
      code: {
        type: 'object',
        required: ['coding'],
        properties: {
          coding: { type: 'array' },
        },
      },
      issued: { type: 'string' },
      conclusion: { type: 'string' },
    },
  };

  it('should validate a well-formed FHIR Patient resource', () => {
    const patient = {
      resourceType: 'Patient',
      id: 'pat-001',
      active: true,
      identifier: [{ system: 'urn:aris:animal', value: 'ANM-KE-001' }],
    };

    const result = engine.validateJsonSchema(patient, fhirPatientSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject a FHIR Observation missing required fields', () => {
    const badObservation = {
      resourceType: 'Observation',
      id: 'obs-001',
      // Missing 'status' and 'code'
    };

    const result = engine.validateJsonSchema(badObservation, fhirObservationSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e: string) => e.includes('status'))).toBe(true);
  });

  it('should validate FHIR DiagnosticReport with nested results', () => {
    const report = {
      resourceType: 'DiagnosticReport',
      id: 'dr-001',
      status: 'final',
      code: {
        coding: [{ system: 'urn:aris:diagnostic', code: 'LAB-FMD' }],
      },
      issued: '2025-03-15T10:30:00Z',
      conclusion: 'Positive for FMD serotype O',
    };

    const result = engine.validateJsonSchema(report, fhirDiagnosticReportSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
