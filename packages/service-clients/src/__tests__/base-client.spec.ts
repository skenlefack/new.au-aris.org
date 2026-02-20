import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  BaseServiceClient,
  ServiceClientError,
  CircuitBreakerOpenError,
} from '../base-client';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Map([['content-type', 'application/json']]) as unknown as Headers,
  } as unknown as Response;
}

function createClient(overrides: Record<string, unknown> = {}) {
  return new BaseServiceClient({
    baseUrl: 'http://localhost:3000',
    serviceName: 'test-service',
    maxRetries: 2,
    retryDelayMs: 10, // Fast retries for tests
    cbFailureThreshold: 3,
    cbResetTimeoutMs: 100,
    ...overrides,
  });
}

describe('BaseServiceClient', () => {
  let client: BaseServiceClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = createClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('should make a GET request', async () => {
      mockFetch.mockResolvedValue(makeResponse(200, { data: 'ok' }));

      const result = await client.get('/api/test');

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ data: 'ok' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should make a POST request with body', async () => {
      mockFetch.mockResolvedValue(makeResponse(201, { data: { id: '123' } }));

      const result = await client.post('/api/items', { name: 'test' });

      expect(result.status).toBe(201);
      expect(result.data).toEqual({ data: { id: '123' } });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        }),
      );
    });

    it('should make a PATCH request', async () => {
      mockFetch.mockResolvedValue(makeResponse(200, { data: { updated: true } }));

      const result = await client.patch('/api/items/1', { name: 'updated' });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ data: { updated: true } });
    });

    it('should forward custom headers', async () => {
      mockFetch.mockResolvedValue(makeResponse(200, { data: 'ok' }));

      await client.get('/api/test', { 'x-tenant-id': 'tenant-ke' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({ 'x-tenant-id': 'tenant-ke' }),
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on server errors (5xx)', async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(503, { error: 'unavailable' }, false))
        .mockResolvedValueOnce(makeResponse(503, { error: 'unavailable' }, false))
        .mockResolvedValueOnce(makeResponse(200, { data: 'ok' }));

      const result = await client.get('/api/test');

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should NOT retry on client errors (4xx)', async () => {
      mockFetch.mockResolvedValue(makeResponse(404, { error: 'not found' }, false));

      await expect(client.get('/api/test')).rejects.toThrow(ServiceClientError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for 4xx
    });

    it('should throw after max retries exhausted', async () => {
      mockFetch.mockResolvedValue(makeResponse(500, { error: 'server error' }, false));

      await expect(client.get('/api/test')).rejects.toThrow(ServiceClientError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries (maxRetries=2)
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(makeResponse(200, { data: 'recovered' }));

      const result = await client.get('/api/test');

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('circuit breaker', () => {
    it('should open after threshold failures', async () => {
      mockFetch.mockResolvedValue(makeResponse(500, { error: 'down' }, false));

      // Exhaust 3 requests (threshold is 3), each with 2 retries = 9 fetch calls
      for (let i = 0; i < 3; i++) {
        await expect(client.get('/api/test')).rejects.toThrow(ServiceClientError);
      }

      expect(client.getCircuitState()).toBe('OPEN');

      // Next request should fail immediately without calling fetch
      const callsBefore = mockFetch.mock.calls.length;
      await expect(client.get('/api/test')).rejects.toThrow(CircuitBreakerOpenError);
      expect(mockFetch.mock.calls.length).toBe(callsBefore); // No new fetch calls
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      mockFetch.mockResolvedValue(makeResponse(500, { error: 'down' }, false));

      // Trigger circuit breaker open
      for (let i = 0; i < 3; i++) {
        await expect(client.get('/api/test')).rejects.toThrow(ServiceClientError);
      }
      expect(client.getCircuitState()).toBe('OPEN');

      // Wait for reset timeout (100ms in test config)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Now fetch should succeed, transitioning to CLOSED
      mockFetch.mockResolvedValue(makeResponse(200, { data: 'ok' }));
      const result = await client.get('/api/test');

      expect(result.status).toBe(200);
      expect(client.getCircuitState()).toBe('CLOSED');
    });

    it('should not count 4xx errors as circuit breaker failures', async () => {
      mockFetch.mockResolvedValue(makeResponse(400, { error: 'bad request' }, false));

      // Make many 4xx requests — should never open the circuit
      for (let i = 0; i < 10; i++) {
        await expect(client.get('/api/test')).rejects.toThrow(ServiceClientError);
      }

      expect(client.getCircuitState()).toBe('CLOSED');
    });

    it('should reset circuit breaker on success', async () => {
      const cb3Client = createClient({ cbFailureThreshold: 3 });

      // Two failures
      mockFetch.mockResolvedValue(makeResponse(500, { error: 'fail' }, false));
      await expect(cb3Client.get('/api/test')).rejects.toThrow();
      await expect(cb3Client.get('/api/test')).rejects.toThrow();

      // One success resets
      mockFetch.mockResolvedValue(makeResponse(200, { data: 'ok' }));
      await cb3Client.get('/api/test');

      expect(cb3Client.getCircuitState()).toBe('CLOSED');

      // Two more failures — should not trip because count was reset
      mockFetch.mockResolvedValue(makeResponse(500, { error: 'fail' }, false));
      await expect(cb3Client.get('/api/test')).rejects.toThrow();
      await expect(cb3Client.get('/api/test')).rejects.toThrow();

      expect(cb3Client.getCircuitState()).toBe('CLOSED');
    });
  });

  describe('timeout', () => {
    it('should timeout slow requests', async () => {
      const slowClient = createClient({ timeoutMs: 50, maxRetries: 0 });

      mockFetch.mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(makeResponse(200, {})), 200);
          // Respect AbortSignal like real fetch does
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      await expect(slowClient.get('/api/slow')).rejects.toThrow('timed out');
    });
  });

  describe('tenant header forwarding', () => {
    it('buildHeaders should include tenant and auth headers', () => {
      // Access the protected method via a subclass
      class TestClient extends BaseServiceClient {
        testBuildHeaders(tenantId?: string, authToken?: string) {
          return this.buildHeaders(tenantId, authToken);
        }
      }

      const testClient = new TestClient({
        baseUrl: 'http://localhost:3000',
        serviceName: 'test',
      });

      const headers = testClient.testBuildHeaders('tenant-ke', 'jwt-token');

      expect(headers['x-tenant-id']).toBe('tenant-ke');
      expect(headers['Authorization']).toBe('Bearer jwt-token');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
