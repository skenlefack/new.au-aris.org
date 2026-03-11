// All API calls use relative paths by default (same origin → no CORS).
// In dev: Next.js rewrites proxy /api/v1/* to the correct backend port.
// In production: Traefik routes /api/v1/* to the correct backend service.
// Override with NEXT_PUBLIC_API_BASE_URL if you need a different base.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

interface ApiError {
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function getStoredAuth(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        accessToken: parsed?.state?.accessToken ?? null,
        refreshToken: parsed?.state?.refreshToken ?? null,
      };
    }
  } catch {
    // ignore parse errors
  }
  return { accessToken: null, refreshToken: null };
}

function getSelectedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aris-tenant');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.selectedTenantId ?? null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function getStoredLocale(): string {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = localStorage.getItem('aris-locale');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.locale ?? 'en';
    }
  } catch {
    // ignore parse errors
  }
  return 'en';
}

function buildHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const accessToken = token ?? getStoredAuth().accessToken;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const tenantId = getSelectedTenantId();
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  headers['X-Locale'] = getStoredLocale();

  return headers;
}

function updateStoredTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state) {
        parsed.state.accessToken = accessToken;
        if (refreshToken) {
          parsed.state.refreshToken = refreshToken;
        }
        localStorage.setItem('aris-auth', JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore
  }
}

function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state) {
        parsed.state.accessToken = null;
        parsed.state.refreshToken = null;
        parsed.state.user = null;
        parsed.state.isAuthenticated = false;
        localStorage.setItem('aris-auth', JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore
  }
}

async function attemptTokenRefresh(): Promise<string | null> {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/credential/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Only clear auth on definitive rejection (401/403), not on network/server errors
      if (res.status === 401 || res.status === 403) {
        clearStoredAuth();
      }
      return null;
    }

    const body = await res.json();
    const newAccessToken = body?.data?.accessToken;
    const newRefreshToken = body?.data?.refreshToken;
    if (newAccessToken) {
      // Save both tokens — backend rotates refresh tokens on each use
      updateStoredTokens(newAccessToken, newRefreshToken);
      return newAccessToken;
    }
    return null;
  } catch {
    // Network error — don't clear auth, the server may just be temporarily unreachable
    return null;
  }
}

async function refreshTokenIfNeeded(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = attemptTokenRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: ApiError | undefined;
    try {
      body = await response.json();
    } catch {
      // non-json error
    }
    throw new ApiClientError(
      response.status,
      body?.message ?? `Request failed with status ${response.status}`,
      body?.errors,
    );
  }
  return response.json();
}

async function fetchWithRefresh<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);

  if (res.status === 401) {
    // Only attempt token refresh for authenticated requests (those with an Authorization header).
    // Unauthenticated endpoints (login, register) should surface the 401 error directly.
    const headers = init.headers as Record<string, string> | undefined;
    const hadAuth = !!headers?.['Authorization'];

    if (hadAuth) {
      const newToken = await refreshTokenIfNeeded();
      if (newToken) {
        const retryHeaders = {
          ...Object.fromEntries(Object.entries(headers!)),
          Authorization: `Bearer ${newToken}`,
        };
        const retryRes = await fetch(url, { ...init, headers: retryHeaders });
        return handleResponse<T>(retryRes);
      }

      // Refresh failed — redirect to login
      if (typeof window !== 'undefined') {
        clearStoredAuth();
        window.location.href = '/';
      }
      throw new ApiClientError(401, 'Session expirée. Veuillez vous reconnecter.');
    }
  }

  return handleResponse<T>(res);
}

// ─── Service client factory ───────────────────────────────────────────────
// In production, set NEXT_PUBLIC_API_BASE_URL to the Traefik gateway (port 4000)
// and all clients will use it. In dev, each service has its own port.

function buildServiceClient(baseUrl: string) {
  return {
    get: async <T>(path: string, params?: Record<string, string>): Promise<T> => {
      let url = `${baseUrl}${path}`;
      if (params && Object.keys(params).length > 0) {
        url += `?${new URLSearchParams(params).toString()}`;
      }
      return fetchWithRefresh<T>(url, { method: 'GET', headers: buildHeaders() });
    },
    post: async <T>(path: string, body?: unknown): Promise<T> =>
      fetchWithRefresh<T>(`${baseUrl}${path}`, { method: 'POST', headers: buildHeaders(), body: body ? JSON.stringify(body) : undefined }),
    put: async <T>(path: string, body?: unknown): Promise<T> =>
      fetchWithRefresh<T>(`${baseUrl}${path}`, { method: 'PUT', headers: buildHeaders(), body: body ? JSON.stringify(body) : undefined }),
    patch: async <T>(path: string, body?: unknown): Promise<T> =>
      fetchWithRefresh<T>(`${baseUrl}${path}`, { method: 'PATCH', headers: buildHeaders(), body: body ? JSON.stringify(body) : undefined }),
    delete: async <T>(path: string): Promise<T> =>
      fetchWithRefresh<T>(`${baseUrl}${path}`, { method: 'DELETE', headers: buildHeaders() }),
  };
}

// All domain clients share the same base URL.
// Next.js rewrites (next.config.js) proxy each path prefix to the correct backend port.
// This eliminates CORS issues in dev mode since all requests stay on the same origin.
export const collecteClient     = buildServiceClient(API_BASE_URL);
export const animalHealthClient = buildServiceClient(API_BASE_URL);
export const livestockClient    = buildServiceClient(API_BASE_URL);
export const fisheriesClient    = buildServiceClient(API_BASE_URL);
export const wildlifeClient     = buildServiceClient(API_BASE_URL);
export const apicultureClient   = buildServiceClient(API_BASE_URL);
export const tradeSpsClient     = buildServiceClient(API_BASE_URL);
export const governanceClient   = buildServiceClient(API_BASE_URL);
export const climateEnvClient   = buildServiceClient(API_BASE_URL);
export const analyticsClient    = buildServiceClient(API_BASE_URL);
export const knowledgeHubClient = buildServiceClient(API_BASE_URL);

export const apiClient = {
  get: async <T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> => {
    let url = `${API_BASE_URL}${path}`;
    if (params && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    }
    return fetchWithRefresh<T>(url, {
      method: 'GET',
      headers: buildHeaders(),
    });
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    return fetchWithRefresh<T>(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put: async <T>(path: string, body?: unknown): Promise<T> => {
    return fetchWithRefresh<T>(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch: async <T>(path: string, body?: unknown): Promise<T> => {
    return fetchWithRefresh<T>(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: async <T>(path: string): Promise<T> => {
    return fetchWithRefresh<T>(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
  },
};
