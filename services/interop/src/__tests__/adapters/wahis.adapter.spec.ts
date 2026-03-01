import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WahisAdapter } from '../../adapters/wahis.adapter.js';

describe('WahisAdapter', () => {
  let adapter: WahisAdapter;

  beforeEach(() => {
    adapter = new WahisAdapter();
  });

  it('should format ARIS health event as WAHIS-ready package', () => {
    const arisEvent = {
      diseaseId: 'FMD-001',
      countryCode: 'KE',
      reportDate: '2025-03-15',
      status: 'CONFIRMED',
      species: 'Bovine',
      cases: 42,
      deaths: 3,
    };

    const wahisPackage = adapter.mapToExternal(arisEvent, 'outbreak') as Record<string, unknown>;

    expect(wahisPackage).toMatchObject({
      disease_id: 'FMD-001',
      country: 'KE',
      report_date: '2025-03-15',
      status: 'CONFIRMED',
      species: 'Bovine',
      cases: 42,
      deaths: 3,
      report_type: 'IMMEDIATE',
      source_system: 'ARIS',
    });
  });

  it('should return connection test result with latency', async () => {
    // Mock fetch to simulate a successful connection
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const result = await adapter.testConnection({
      baseUrl: 'https://wahis-test.example.com',
      authType: 'API_KEY',
      credentials: { headerName: 'X-API-Key', apiKey: 'test-key' },
      config: {},
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('WAHIS connection successful');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    globalThis.fetch = originalFetch;
  });
});
