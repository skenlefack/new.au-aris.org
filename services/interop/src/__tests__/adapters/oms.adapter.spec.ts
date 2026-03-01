import { describe, it, expect, beforeEach } from 'vitest';
import { OmsAdapter } from '../../adapters/oms.adapter.js';

describe('OmsAdapter', () => {
  let adapter: OmsAdapter;

  beforeEach(() => {
    adapter = new OmsAdapter();
  });

  it('should format data for WHO GHO API', () => {
    const arisData = {
      indicatorCode: 'LIVESTOCK_DENSITY',
      countryCode: 'KE',
      year: 2024,
      value: 12500000,
    };

    const ghoData = adapter.mapToExternal(arisData, 'indicator') as Record<string, unknown>;

    expect(ghoData).toMatchObject({
      IndicatorCode: 'LIVESTOCK_DENSITY',
      SpatialDim: 'KE',
      TimeDim: 2024,
      NumericValue: 12500000,
      source_system: 'ARIS',
    });
  });
});
