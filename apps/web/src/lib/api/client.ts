const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1';

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

  return headers;
}

function updateStoredToken(accessToken: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state) {
        parsed.state.accessToken = accessToken;
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
    const res = await fetch(`${API_BASE_URL}/credential/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearStoredAuth();
      return null;
    }

    const body = await res.json();
    const newToken = body?.data?.accessToken;
    if (newToken) {
      updateStoredToken(newToken);
      return newToken;
    }
    return null;
  } catch {
    clearStoredAuth();
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
    const newToken = await refreshTokenIfNeeded();
    if (newToken) {
      const retryHeaders = {
        ...Object.fromEntries(
          Object.entries(init.headers as Record<string, string>),
        ),
        Authorization: `Bearer ${newToken}`,
      };
      const retryRes = await fetch(url, { ...init, headers: retryHeaders });
      return handleResponse<T>(retryRes);
    }

    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') {
      clearStoredAuth();
      window.location.href = '/login';
    }
    throw new ApiClientError(401, 'Session expired. Please log in again.');
  }

  return handleResponse<T>(res);
}

export const apiClient = {
  get: async <T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> => {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    return fetchWithRefresh<T>(url.toString(), {
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
