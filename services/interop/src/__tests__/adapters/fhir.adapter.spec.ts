import { describe, it, expect, beforeEach } from 'vitest';
import { FhirAdapter } from '../../adapters/fhir.adapter.js';

describe('FhirAdapter', () => {
  let adapter: FhirAdapter;

  beforeEach(() => {
    adapter = new FhirAdapter();
  });

  it('should map ARIS record to FHIR Patient resource', () => {
    const arisRecord = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      identifier: 'ANM-KE-2025-001',
      species: 'Bovine',
    };

    const patient = adapter.mapToExternal(arisRecord, 'Patient') as Record<string, unknown>;

    expect(patient).toMatchObject({
      resourceType: 'Patient',
      id: '123e4567-e89b-12d3-a456-426614174000',
      active: true,
    });
    expect(patient['identifier']).toEqual([
      { system: 'urn:aris:animal', value: 'ANM-KE-2025-001' },
    ]);

    // Verify species extension
    const extensions = patient['extension'] as Array<Record<string, unknown>>;
    expect(extensions).toHaveLength(1);
    expect(extensions[0]['url']).toBe('http://hl7.org/fhir/StructureDefinition/patient-animal');
  });

  it('should validate FHIR R4 resource structure', () => {
    // Valid resource
    const validResource = {
      resourceType: 'Observation',
      id: 'obs-001',
      status: 'final',
      code: { coding: [{ system: 'urn:aris', code: 'FMD-TEST' }] },
    };
    expect(adapter.validate(validResource).valid).toBe(true);

    // Invalid resource (missing resourceType)
    const invalidResource = { id: 'obs-002' };
    const result = adapter.validate(invalidResource);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('resourceType is required');
  });
});
