import { describe, it, expect } from 'vitest';
import { QualityGateResult } from '@aris/shared-types';
import { GeographicConsistencyGate } from '../geographic-consistency.gate';

describe('GeographicConsistencyGate', () => {
  const gate = new GeographicConsistencyGate();

  it('should PASS when geo codes are valid and coordinates in Africa bounds', () => {
    const record = { countryCode: 'KE', latitude: -1.28, longitude: 36.82 };
    const result = gate.execute(record, {
      geoFields: ['countryCode'],
      validCodes: { geo: new Set(['KE', 'ET', 'NG']) },
      coordinateFields: ['latitude', 'longitude'],
    });
    expect(result.result).toBe(QualityGateResult.PASS);
  });

  it('should FAIL when geo code is not in valid set', () => {
    const record = { countryCode: 'XX' };
    const result = gate.execute(record, {
      geoFields: ['countryCode'],
      validCodes: { geo: new Set(['KE', 'ET', 'NG']) },
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('XX');
  });

  it('should FAIL when coordinates are outside Africa bounds', () => {
    const record = { latitude: 60.0, longitude: 10.0 }; // Norway
    const result = gate.execute(record, {
      coordinateFields: ['latitude', 'longitude'],
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
    expect(result.violations[0].message).toContain('outside bounds');
  });

  it('should use custom coordinate bounds when provided', () => {
    const record = { latitude: -1.28, longitude: 36.82 };
    const result = gate.execute(record, {
      coordinateFields: ['latitude', 'longitude'],
      coordinateBounds: [0, 10, 0, 10], // Nairobi is outside this box
    });
    expect(result.result).toBe(QualityGateResult.FAIL);
  });

  it('should SKIP when no geo config provided', () => {
    const result = gate.execute({ name: 'Test' }, {});
    expect(result.result).toBe(QualityGateResult.SKIPPED);
  });
});
