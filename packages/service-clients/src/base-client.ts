import { Logger } from '@nestjs/common';

// ── Types ──

export interface ServiceClientConfig {
  /** Base URL of the target service (e.g. http://localhost:3004) */
  baseUrl: string;
  /** Request timeout in ms (default: 5000) */
  timeoutMs?: number;
  /** Max retry attempts on transient failures (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms, doubled each attempt (default: 200) */
  retryDelayMs?: number;
  /** Circuit breaker: failures before opening (default: 5) */
  cbFailureThreshold?: number;
  /** Circuit breaker: open duration in ms before half-open (default: 30000) */
  cbResetTimeoutMs?: number;
  /** Service name for logging */
  serviceName?: string;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ServiceResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export class ServiceClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: unknown,
    public readonly serviceName?: string,
  ) {
    super(message);
    this.name = 'ServiceClientError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker is OPEN for ${serviceName}. Requests are blocked.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ── Circuit Breaker State ──

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
}

// ── Base Client ──

export class BaseServiceClient {
  protected readonly logger: Logger;
  protected readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly cbFailureThreshold: number;
  private readonly cbResetTimeoutMs: number;
  private readonly serviceName: string;
  private cb: CircuitBreakerState;

  constructor(config: ServiceClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 200;
    this.cbFailureThreshold = config.cbFailureThreshold ?? 5;
    this.cbResetTimeoutMs = config.cbResetTimeoutMs ?? 30000;
    this.serviceName = config.serviceName ?? 'unknown-service';
    this.logger = new Logger(`ServiceClient:${this.serviceName}`);

    this.cb = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
    };
  }

  // ── Public API ──

  async request<T = unknown>(options: RequestOptions): Promise<ServiceResponse<T>> {
    this.checkCircuitBreaker();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.executeRequest<T>(options);
        this.onSuccess();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) — only on transient/server errors
        if (error instanceof ServiceClientError && error.status >= 400 && error.status < 500) {
          this.onSuccess(); // 4xx is not a circuit-breaker failure
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `${this.serviceName} ${options.method} ${options.path} attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.onFailure();
    throw lastError!;
  }

  async get<T = unknown>(path: string, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'GET', path, headers });
  }

  async post<T = unknown>(path: string, body: unknown, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'POST', path, body, headers });
  }

  async patch<T = unknown>(path: string, body: unknown, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'PATCH', path, body, headers });
  }

  // ── Tenant Header Forwarding ──

  protected buildHeaders(
    tenantId?: string,
    authToken?: string,
    extra?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra ?? {}),
    };
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }

  // ── Circuit Breaker ──

  getCircuitState(): CircuitState {
    return this.cb.state;
  }

  /** Exposed for testing */
  resetCircuitBreaker(): void {
    this.cb = { state: 'CLOSED', failureCount: 0, lastFailureTime: 0 };
  }

  private checkCircuitBreaker(): void {
    if (this.cb.state === 'OPEN') {
      const elapsed = Date.now() - this.cb.lastFailureTime;
      if (elapsed >= this.cbResetTimeoutMs) {
        this.cb.state = 'HALF_OPEN';
        this.logger.log(`${this.serviceName} circuit breaker → HALF_OPEN (testing)`);
      } else {
        throw new CircuitBreakerOpenError(this.serviceName);
      }
    }
  }

  private onSuccess(): void {
    if (this.cb.state === 'HALF_OPEN') {
      this.logger.log(`${this.serviceName} circuit breaker → CLOSED (recovered)`);
    }
    this.cb = { state: 'CLOSED', failureCount: 0, lastFailureTime: 0 };
  }

  private onFailure(): void {
    this.cb.failureCount++;
    this.cb.lastFailureTime = Date.now();

    if (this.cb.failureCount >= this.cbFailureThreshold) {
      this.cb.state = 'OPEN';
      this.logger.error(
        `${this.serviceName} circuit breaker → OPEN after ${this.cb.failureCount} failures`,
      );
    }
  }

  // ── HTTP Execution ──

  private async executeRequest<T>(options: RequestOptions): Promise<ServiceResponse<T>> {
    const url = `${this.baseUrl}${options.path}`;
    const timeout = options.timeoutMs ?? this.timeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      };

      if (options.body !== undefined) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      let responseData: T;

      try {
        responseData = JSON.parse(responseText) as T;
      } catch {
        responseData = responseText as unknown as T;
      }

      if (!response.ok) {
        throw new ServiceClientError(
          `${this.serviceName} ${options.method} ${options.path} returned ${response.status}`,
          response.status,
          responseData,
          this.serviceName,
        );
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return { status: response.status, data: responseData, headers: responseHeaders };
    } catch (error) {
      if (error instanceof ServiceClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceClientError(
          `${this.serviceName} ${options.method} ${options.path} timed out after ${timeout}ms`,
          0,
          undefined,
          this.serviceName,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
