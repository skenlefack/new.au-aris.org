/**
 * ARIS 4.0 — E2E API Test Helpers
 *
 * Provides authenticated HTTP client for testing against staging or production API.
 *
 * Environment variables:
 *   ARIS_E2E_BASE_URL  — API base (default: http://10.202.101.146:3002 staging)
 *   ARIS_E2E_EMAIL     — Login email (default: admin@au-aris.org)
 *   ARIS_E2E_PASSWORD  — Login password (default: Aris2026@@4!0)
 */

const BASE_URL = process.env.ARIS_E2E_BASE_URL ?? 'http://10.202.101.146';
const LOGIN_EMAIL = process.env.ARIS_E2E_EMAIL ?? 'admin@au-aris.org';
const LOGIN_PASSWORD = process.env.ARIS_E2E_PASSWORD ?? 'Aris2026@@4!0';

let cachedToken: string | null = null;

/** Login and return a valid JWT access token. Result is cached for the test run. */
export async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const res = await fetch(`${BASE_URL}:3002/api/v1/credential/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  cachedToken = json.data?.accessToken ?? json.accessToken;
  if (!cachedToken) throw new Error('No accessToken in login response');
  return cachedToken;
}

/** Reset cached token (for testing token refresh, etc.) */
export function clearToken(): void {
  cachedToken = null;
}

/** Authenticated GET request. */
export async function apiGet<T = any>(
  port: number,
  path: string,
  params?: Record<string, string>,
): Promise<{ status: number; data: T; raw: any }> {
  const token = await getToken();
  const url = new URL(path, `${BASE_URL}:${port}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, data: raw?.data ?? raw, raw };
}

/** Authenticated POST request. */
export async function apiPost<T = any>(
  port: number,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T; raw: any }> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}:${port}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, data: raw?.data ?? raw, raw };
}

/** Authenticated PATCH request. */
export async function apiPatch<T = any>(
  port: number,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T; raw: any }> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}:${port}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, data: raw?.data ?? raw, raw };
}

/** Authenticated DELETE request. */
export async function apiDelete(
  port: number,
  path: string,
): Promise<{ status: number; raw: any }> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}:${port}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, raw };
}

/** Service port map for convenience. */
export const PORTS = {
  tenant: 3001,
  credential: 3002,
  masterData: 3003,
  dataQuality: 3004,
  dataContract: 3005,
  message: 3006,
  drive: 3007,
  realtime: 3008,
  formBuilder: 3010,
  collecte: 3011,
  workflow: 3012,
  animalHealth: 3020,
  livestockProd: 3021,
  fisheries: 3022,
  wildlife: 3023,
  apiculture: 3024,
  tradeSps: 3025,
  governance: 3026,
  climateEnv: 3027,
  analytics: 3030,
  geoServices: 3031,
  interopHub: 3032,
  knowledgeHub: 3033,
  dataSharing: 3034,
} as const;
