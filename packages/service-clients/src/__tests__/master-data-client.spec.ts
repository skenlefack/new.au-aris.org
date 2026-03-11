import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MasterDataClient } from '../master-data-client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Map([['content-type', 'application/json']]) as unknown as Headers,
  } as unknown as Response;
}

describe('MasterDataClient', () => {
  let client: MasterDataClient;

  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env['MASTER_DATA_SERVICE_URL'];
    client = new MasterDataClient({ maxRetries: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send GET for getDisease()', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { id: 'd1', code: 'FMD' } }));

    await client.getDisease('d1', 'tenant-ke', 'jwt-token');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(url).toContain('/api/v1/master-data/diseases/d1');
  });

  it('should send GET for getSpecies()', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { id: 's1', code: 'BOV' } }));

    await client.getSpecies('s1', 'tenant-ke', 'jwt-token');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(url).toContain('/api/v1/master-data/species/s1');
  });

  it('should include tenant and auth headers', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.getDisease('d1', 'tenant-ke', 'jwt-token');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['x-tenant-id']).toBe('tenant-ke');
    expect(opts.headers['Authorization']).toBe('Bearer jwt-token');
  });

  it('should fall back to localhost:3003', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.getDisease('d1', 'tenant-ke');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('http://localhost:3003');
  });
});
