import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataQualityClient } from '../data-quality-client';

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

describe('DataQualityClient', () => {
  let client: DataQualityClient;

  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env['DATA_QUALITY_SERVICE_URL'];
    client = new DataQualityClient({ maxRetries: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send POST request for validate()', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { overallStatus: 'PASSED' } }));

    await client.validate(
      { recordId: 'r1', entityType: 'outbreak', domain: 'health', record: {} },
      'tenant-ke',
      'jwt-token',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(url).toContain('/api/v1/data-quality/validate');
  });

  it('should include tenant and auth headers', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.validate(
      { recordId: 'r1', entityType: 'outbreak', domain: 'health', record: {} },
      'tenant-ke',
      'jwt-token',
    );

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['x-tenant-id']).toBe('tenant-ke');
    expect(opts.headers['Authorization']).toBe('Bearer jwt-token');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('should use env var DATA_QUALITY_SERVICE_URL when set', async () => {
    process.env['DATA_QUALITY_SERVICE_URL'] = 'http://quality:3004';
    const envClient = new DataQualityClient({ maxRetries: 0 });
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await envClient.validate(
      { recordId: 'r1', entityType: 'outbreak', domain: 'health', record: {} },
      'tenant-ke',
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('http://quality:3004');
  });

  it('should fall back to localhost:3004', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.validate(
      { recordId: 'r1', entityType: 'outbreak', domain: 'health', record: {} },
      'tenant-ke',
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('http://localhost:3004');
  });
});
