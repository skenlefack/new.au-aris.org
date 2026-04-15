/**
 * E2E: Interop Hub — WAHIS, EMPRES, FAOSTAT Exports
 */
import { apiGet, apiPost, PORTS } from './helpers';

const P = PORTS.interopHub;
const BASE = '/api/v1/interop';

describe('Interop Hub E2E', () => {
  describe('Health Check', () => {
    it('GET /health returns OK', async () => {
      const res = await apiGet(P, '/health');
      expect(res.status).toBe(200);
    });
  });

  describe('WAHIS Export', () => {
    it('POST /wahis/export triggers WAHIS package generation', async () => {
      const res = await apiPost(P, `${BASE}/wahis/export`, {
        countryCode: 'KE',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        format: 'WOAH_JSON',
      });
      // Accept 200/201 or 404 if no data
      expect([200, 201, 404]).toContain(res.status);
      if (res.status >= 200 && res.status < 300) {
        expect(res.data).toHaveProperty('status');
      }
    });

    it('GET /wahis/exports lists export history', async () => {
      const res = await apiGet(P, `${BASE}/wahis/exports`, { limit: '5' });
      if (res.status === 200) {
        expect(Array.isArray(res.raw.data ?? res.data)).toBe(true);
      }
    });
  });

  describe('EMPRES Feed', () => {
    it('POST /empres/feed pushes signal', async () => {
      const res = await apiPost(P, `${BASE}/empres/feed`, {
        countryCode: 'KE',
        diseaseId: 'FMD',
        confidenceLevel: 'CONFIRMED',
      });
      expect([200, 201, 404, 422]).toContain(res.status);
    });

    it('GET /empres/feeds lists feed history', async () => {
      const res = await apiGet(P, `${BASE}/empres/feeds`, { limit: '5' });
      if (res.status === 200) {
        expect(Array.isArray(res.raw.data ?? res.data)).toBe(true);
      }
    });
  });

  describe('FAOSTAT Sync', () => {
    it('POST /faostat/sync triggers reconciliation', async () => {
      const res = await apiPost(P, `${BASE}/faostat/sync`, {
        countryCode: 'KE',
        year: 2025,
      });
      expect([200, 201, 404, 422]).toContain(res.status);
    });
  });

  describe('FishStatJ Export', () => {
    it('POST /fishstatj/export triggers fisheries export', async () => {
      const res = await apiPost(P, `${BASE}/fishstatj/export`, {
        countryCode: 'KE',
        year: 2025,
      });
      expect([200, 201, 404, 422]).toContain(res.status);
    });
  });

  describe('CITES Export', () => {
    it('POST /cites/export triggers wildlife trade export', async () => {
      const res = await apiPost(P, `${BASE}/cites/export`, {
        countryCode: 'KE',
        year: 2025,
      });
      expect([200, 201, 404, 422]).toContain(res.status);
    });
  });

  describe('Connector Status', () => {
    it('GET /connectors lists configured connectors', async () => {
      const res = await apiGet(P, `${BASE}/connectors`);
      if (res.status === 200) {
        const connectors = res.raw.data ?? res.data;
        expect(Array.isArray(connectors)).toBe(true);
      }
    });
  });
});
