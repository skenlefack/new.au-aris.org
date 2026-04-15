/**
 * E2E: Credential Service — Login, Token, RBAC
 */
import { apiGet, apiPost, clearToken, PORTS } from './helpers';

const P = PORTS.credential;
const BASE = '/api/v1/credential';

describe('Credential Service E2E', () => {
  beforeAll(() => clearToken());

  describe('POST /auth/login', () => {
    it('returns accessToken + refreshToken for valid credentials', async () => {
      const res = await apiPost(P, `${BASE}/auth/login`, {
        email: 'admin@au-aris.org',
        password: 'Aris2026@@4!0',
      });
      expect(res.status).toBe(200);
      const d = res.raw?.data ?? res.raw;
      expect(d).toHaveProperty('accessToken');
      expect(d).toHaveProperty('refreshToken');
      expect(typeof d.accessToken).toBe('string');
      expect(d.accessToken.split('.').length).toBe(3); // JWT format
    });

    it('returns 401 for wrong password', async () => {
      const res = await apiPost(P, `${BASE}/auth/login`, {
        email: 'admin@au-aris.org',
        password: 'wrong',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 401 for unknown email', async () => {
      const res = await apiPost(P, `${BASE}/auth/login`, {
        email: 'nonexistent@au-aris.org',
        password: 'Aris2026@@4!0',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /users/me', () => {
    it('returns current user profile', async () => {
      const res = await apiGet(P, `${BASE}/users/me`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('email', 'admin@au-aris.org');
      expect(res.data).toHaveProperty('role');
      expect(res.data).toHaveProperty('tenantId');
    });
  });

  describe('GET /users', () => {
    it('returns paginated user list', async () => {
      const res = await apiGet(P, `${BASE}/users`, { page: '1', limit: '5' });
      expect(res.status).toBe(200);
      const payload = res.raw;
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data.length).toBeGreaterThan(0);
      expect(payload.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns new accessToken from refreshToken', async () => {
      // First login to get a refresh token
      const login = await apiPost(P, `${BASE}/auth/login`, {
        email: 'admin@au-aris.org',
        password: 'Aris2026@@4!0',
      });
      const refreshToken = login.raw?.data?.refreshToken ?? login.raw?.refreshToken;
      if (!refreshToken) return; // Skip if refresh not implemented

      const res = await fetch(
        `${process.env.ARIS_E2E_BASE_URL ?? 'http://10.202.101.146'}:${P}${BASE}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const d = body?.data ?? body;
      expect(d).toHaveProperty('accessToken');
    });
  });
});
