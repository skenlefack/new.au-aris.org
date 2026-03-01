import { describe, it, expect, beforeEach } from 'vitest';
import { EmpresAdapter } from '../../adapters/empres.adapter.js';

describe('EmpresAdapter', () => {
  let adapter: EmpresAdapter;

  beforeEach(() => {
    adapter = new EmpresAdapter();
  });

  it('should convert confirmed health event to EMPRES signal', () => {
    const healthEvent = {
      diseaseId: 'ASF-001',
      countryCode: 'NG',
      reportDate: '2025-06-10',
      confidenceLevel: 'CONFIRMED',
      latitude: 9.0765,
      longitude: 7.4986,
      species: 'Porcine',
      cases: 120,
      deaths: 45,
    };

    const signal = adapter.mapToExternal(healthEvent, 'signal') as Record<string, unknown>;

    expect(signal).toMatchObject({
      disease: 'ASF-001',
      country: 'NG',
      observation_date: '2025-06-10',
      confidence: 'CONFIRMED',
      latitude: 9.0765,
      longitude: 7.4986,
      animal_type: 'Porcine',
      cases: 120,
      deaths: 45,
      source_system: 'ARIS',
      signal_type: 'ANIMAL_HEALTH',
    });
  });
});
