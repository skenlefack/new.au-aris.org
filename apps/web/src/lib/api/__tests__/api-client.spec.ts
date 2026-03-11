import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageData: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }),
  length: 0,
  key: vi.fn(),
};

// Must define window and localStorage before importing the module
vi.stubGlobal('window', { location: { href: '' } });
vi.stubGlobal('localStorage', mockLocalStorage);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after global stubs
const { apiClient, ApiClientError } = await import('../client');

function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send GET request with auth headers', async () => {
    localStorageData['aris-auth'] = JSON.stringify({
      state: { accessToken: 'my-jwt', refreshToken: 'my-refresh' },
    });
    mockFetch.mockResolvedValue(makeResponse(200, { data: [] }));

    await apiClient.get('/credential/users');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/credential/users');
    expect(opts.method).toBe('GET');
    expect(opts.headers['Authorization']).toBe('Bearer my-jwt');
  });

  it('should send POST with JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { id: '1' } }));

    await apiClient.post('/credential/auth/login', { email: 'test@test.com', password: 'pass' });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ email: 'test@test.com', password: 'pass' }));
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('should include X-Tenant-Id from localStorage', async () => {
    localStorageData['aris-tenant'] = JSON.stringify({
      state: { selectedTenantId: 'tenant-ke' },
    });
    mockFetch.mockResolvedValue(makeResponse(200, { data: [] }));

    await apiClient.get('/some-path');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Tenant-Id']).toBe('tenant-ke');
  });

  it('should create ApiClientError with statusCode and message', () => {
    const error = new ApiClientError(404, 'Not found', [{ field: 'id', message: 'Invalid' }]);

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.errors).toEqual([{ field: 'id', message: 'Invalid' }]);
    expect(error.name).toBe('ApiClientError');
    expect(error).toBeInstanceOf(Error);
  });

  it('should throw ApiClientError on non-ok response', async () => {
    mockFetch.mockResolvedValue(makeResponse(403, { message: 'Forbidden' }, false));

    await expect(apiClient.get('/protected')).rejects.toThrow(ApiClientError);

    try {
      mockFetch.mockResolvedValue(makeResponse(403, { message: 'Forbidden' }, false));
      await apiClient.get('/protected');
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
    }
  });

  it('should build URL with query params for get', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: [] }));

    await apiClient.get('/items', { page: '1', limit: '20' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
  });

  it('should send DELETE request', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: { message: 'deleted' } }));

    await apiClient.delete('/items/123');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/items/123');
    expect(opts.method).toBe('DELETE');
  });
});
