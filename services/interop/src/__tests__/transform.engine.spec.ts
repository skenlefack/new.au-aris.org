import { describe, it, expect, beforeEach } from 'vitest';
import { TransformEngine } from '../services/transform.engine.js';

describe('TransformEngine', () => {
  let engine: TransformEngine;

  beforeEach(() => {
    engine = new TransformEngine();
  });

  it('should evaluate simple JSONata expression', async () => {
    const data = {
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
    };

    const result = await engine.transform(data, 'firstName & " " & lastName');
    expect(result).toBe('John Doe');

    const ageResult = await engine.transform(data, 'age * 2');
    expect(ageResult).toBe(60);
  });

  it('should apply field mappings with transformations', async () => {
    const record = {
      disease_code: 'FMD',
      country: 'Kenya',
      cases_total: 150,
      deaths_total: 12,
      report_date: '2025-03-15',
    };

    const mappings = [
      { sourceField: 'disease_code', targetField: 'diseaseId', transformation: null },
      { sourceField: 'country', targetField: 'countryName', transformation: null },
      { sourceField: 'cases_total', targetField: 'totalCases', transformation: '$string(cases_total) & " cases"' },
      { sourceField: 'deaths_total', targetField: 'mortalityRate', transformation: '$round(deaths_total / cases_total * 100, 1)' },
    ];

    const result = await engine.applyMappings(record, mappings);

    expect(result['diseaseId']).toBe('FMD');
    expect(result['countryName']).toBe('Kenya');
    expect(result['totalCases']).toBe('150 cases');
    expect(result['mortalityRate']).toBe(8);
  });

  it('should cache compiled expressions for performance', async () => {
    const data = { value: 42 };
    const expression = 'value + 1';

    // First evaluation compiles and caches
    await engine.transform(data, expression);
    expect(engine.getCacheSize()).toBe(1);

    // Second evaluation uses cache
    const result = await engine.transform(data, expression);
    expect(result).toBe(43);
    expect(engine.getCacheSize()).toBe(1);

    // Different expression adds to cache
    await engine.transform(data, 'value * 2');
    expect(engine.getCacheSize()).toBe(2);

    // Clear cache
    engine.clearCache();
    expect(engine.getCacheSize()).toBe(0);
  });
});
