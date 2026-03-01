import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dhis2Adapter } from '../../adapters/dhis2.adapter.js';

describe('Dhis2Adapter', () => {
  let adapter: Dhis2Adapter;

  beforeEach(() => {
    adapter = new Dhis2Adapter();
  });

  it('should push data values to DHIS2 format', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({
        status: 'SUCCESS',
        importCount: { imported: 2, updated: 0, ignored: 0 },
      }),
    });

    const records = [
      { dataElement: 'DE001', orgUnit: 'OU001', period: '202503', value: '100' },
      { dataElement: 'DE002', orgUnit: 'OU001', period: '202503', value: '50' },
    ];

    const result = await adapter.push(records, {
      baseUrl: 'https://dhis2.example.com',
      authType: 'BASIC',
      credentials: { username: 'admin', password: 'secret' },
      config: {},
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.recordsPushed).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Verify the request was made with correct format
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://dhis2.example.com/api/dataValueSets',
      expect.objectContaining({ method: 'POST' }),
    );

    globalThis.fetch = originalFetch;
  });

  it('should pull and parse DHIS2 data value sets', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({
        dataValues: [
          { dataElement: 'DE001', orgUnit: 'OU001', period: '202503', value: '100' },
          { dataElement: 'DE002', orgUnit: 'OU002', period: '202503', value: '200' },
        ],
      }),
    });

    const result = await adapter.pull(
      { entityType: 'dataValue', filters: { orgUnit: 'OU001' } },
      {
        baseUrl: 'https://dhis2.example.com',
        authType: 'BASIC',
        credentials: { username: 'admin', password: 'secret' },
        config: {},
      },
    );

    expect(result.total).toBe(2);
    expect(result.records).toHaveLength(2);
    expect((result.records[0] as Record<string, unknown>)['source']).toBe('DHIS2');

    globalThis.fetch = originalFetch;
  });
});
