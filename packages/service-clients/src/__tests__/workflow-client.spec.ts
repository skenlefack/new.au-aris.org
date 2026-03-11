import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowClient } from '../workflow-client';

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

describe('WorkflowClient', () => {
  let client: WorkflowClient;

  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env['WORKFLOW_SERVICE_URL'];
    client = new WorkflowClient({ maxRetries: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send POST for createInstance()', async () => {
    mockFetch.mockResolvedValue(makeResponse(201, { data: { id: 'wf-1' } }));

    await client.createInstance(
      { entityType: 'outbreak', entityId: 'e1', domain: 'health' },
      'tenant-ke',
      'jwt-token',
    );

    const [url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(url).toContain('/api/v1/workflow/instances');
    expect(JSON.parse(opts.body)).toEqual(
      expect.objectContaining({ entityType: 'outbreak', entityId: 'e1' }),
    );
  });

  it('should send GET for getInstance()', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { id: 'wf-1' } }));

    await client.getInstance('wf-1', 'tenant-ke', 'jwt-token');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(url).toContain('/api/v1/workflow/instances/wf-1');
  });

  it('should include tenant and auth headers', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.getInstance('wf-1', 'tenant-ke', 'jwt-token');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['x-tenant-id']).toBe('tenant-ke');
    expect(opts.headers['Authorization']).toBe('Bearer jwt-token');
  });

  it('should fall back to localhost:3012', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: {} }));

    await client.getInstance('wf-1', 'tenant-ke');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('http://localhost:3012');
  });
});
