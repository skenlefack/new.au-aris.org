import { describe, it, expect, beforeEach } from 'vitest';
import { FaostatAdapter } from '../../adapters/faostat.adapter.js';

describe('FaostatAdapter', () => {
  let adapter: FaostatAdapter;

  beforeEach(() => {
    adapter = new FaostatAdapter();
  });

  it('should reconcile FAOSTAT denominators with national census data', () => {
    const faostatRecord = {
      'Area Code': 404,
      'Area': 'Kenya',
      'Item Code': 866,
      'Item': 'Cattle',
      'Element Code': 5112,
      'Element': 'Stocks',
      'Year': 2023,
      'Value': 18900000,
      'Unit': 'Head',
      'Flag': 'A',
    };

    const internalRecord = adapter.mapToInternal(faostatRecord, 'production') as Record<string, unknown>;

    expect(internalRecord).toMatchObject({
      areaCode: 404,
      countryName: 'Kenya',
      itemCode: 866,
      itemName: 'Cattle',
      elementCode: 5112,
      elementName: 'Stocks',
      year: 2023,
      value: 18900000,
      unit: 'Head',
      flag: 'A',
      source: 'FAOSTAT',
    });

    // Verify reverse mapping for submission
    const externalRecord = adapter.mapToExternal({
      countryCode: 404,
      speciesCode: 866,
      year: 2023,
      value: 19500000,
      unit: 'Head',
    }, 'production') as Record<string, unknown>;

    expect(externalRecord['Area Code']).toBe(404);
    expect(externalRecord['Item Code']).toBe(866);
    expect(externalRecord['Value']).toBe(19500000);
  });
});
