import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimalHealthClient } from '../animal-health-client';

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

describe('AnimalHealthClient', () => {
  let client: AnimalHealthClient;

  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env['ANIMAL_HEALTH_SERVICE_URL'];
    client = new AnimalHealthClient({ maxRetries: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send PATCH for patchHealthEvent()', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { id: 'he-1', wahisReady: true } }));

    await client.patchHealthEvent('he-1', { wahisReady: true }, 'tenant-ke', 'jwt-token');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('PATCH');
    expect(url).toContain('/api/v1/animal-health/health-events/he-1');
  });

  it('should use kebab-case URL for patchEntity()', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.patchEntity('HealthEvent', 'he-1', { wahisReady: true }, 'tenant-ke');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/animal-health/health-event/he-1');
  });

  it('should include tenant and auth headers', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.patchHealthEvent('he-1', { wahisReady: true }, 'tenant-ke', 'jwt-token');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['x-tenant-id']).toBe('tenant-ke');
    expect(opts.headers['Authorization']).toBe('Bearer jwt-token');
  });

  it('should fall back to localhost:3020', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.patchHealthEvent('he-1', {}, 'tenant-ke');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('http://localhost:3020');
  });
});
