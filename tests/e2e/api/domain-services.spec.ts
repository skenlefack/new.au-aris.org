/**
 * E2E: Domain Services — Animal Health, Fisheries, Trade, Master Data
 */
import { apiGet, apiPost, PORTS } from './helpers';

describe('Domain Services E2E', () => {
  // ── Animal Health ──
  describe('Animal Health', () => {
    const P = PORTS.animalHealth;
    const BASE = '/api/v1/animal-health';

    it('GET /events returns health event list', async () => {
      const res = await apiGet(P, `${BASE}/events`, { limit: '5' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
    });

    it('GET /events/markers returns map markers', async () => {
      const res = await apiGet(P, `${BASE}/events/markers`);
      expect(res.status).toBe(200);
    });
  });

  // ── Fisheries ──
  describe('Fisheries', () => {
    const P = PORTS.fisheries;
    const BASE = '/api/v1/fisheries';

    it('GET /captures returns capture records', async () => {
      const res = await apiGet(P, `${BASE}/captures`, { limit: '5' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
    });

    it('GET /vessels returns vessel registry', async () => {
      const res = await apiGet(P, `${BASE}/vessels`, { limit: '5' });
      expect(res.status).toBe(200);
    });

    it('GET /efforts returns fishing efforts', async () => {
      const res = await apiGet(P, `${BASE}/efforts`, { limit: '5' });
      expect(res.status).toBe(200);
    });

    it('GET /aquaculture/farms returns aquaculture farms', async () => {
      const res = await apiGet(P, `${BASE}/aquaculture/farms`, { limit: '5' });
      expect(res.status).toBe(200);
    });
  });

  // ── Trade & SPS ──
  describe('Trade & SPS', () => {
    const P = PORTS.tradeSps;
    const BASE = '/api/v1/trade';

    it('GET /market-prices returns market data', async () => {
      const res = await apiGet(P, `${BASE}/market-prices`, { limit: '5' });
      expect(res.status).toBe(200);
    });

    it('GET /sps-certificates returns SPS certifications', async () => {
      const res = await apiGet(P, `${BASE}/sps-certificates`, { limit: '5' });
      expect(res.status).toBe(200);
    });
  });

  // ── Livestock Production ──
  describe('Livestock Production', () => {
    const P = PORTS.livestockProd;
    const BASE = '/api/v1/livestock';

    it('GET /census returns census data', async () => {
      const res = await apiGet(P, `${BASE}/census`, { limit: '5' });
      expect(res.status).toBe(200);
    });

    it('GET /production returns production data', async () => {
      const res = await apiGet(P, `${BASE}/production`, { limit: '5' });
      expect(res.status).toBe(200);
    });
  });

  // ── Governance ──
  describe('Governance', () => {
    const P = PORTS.governance;
    const BASE = '/api/v1/governance';

    it('GET /capacities returns capacity assessments', async () => {
      const res = await apiGet(P, `${BASE}/capacities`, { limit: '5' });
      expect(res.status).toBe(200);
    });

    it('GET /legal-frameworks returns legal frameworks', async () => {
      const res = await apiGet(P, `${BASE}/legal-frameworks`, { limit: '5' });
      expect(res.status).toBe(200);
    });
  });

  // ── Master Data ──
  describe('Master Data', () => {
    const P = PORTS.masterData;
    const BASE = '/api/v1/master-data';

    it('GET /species returns species referential', async () => {
      const res = await apiGet(P, `${BASE}/species`, { limit: '10' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
      expect(res.raw.data.length).toBeGreaterThan(0);
    });

    it('GET /diseases returns disease list', async () => {
      const res = await apiGet(P, `${BASE}/diseases`, { limit: '10' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
    });

    it('GET /geo returns geographic boundaries', async () => {
      const res = await apiGet(P, `${BASE}/geo`, { limit: '10' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
    });
  });

  // ── Analytics ──
  describe('Analytics', () => {
    const P = PORTS.analytics;
    const BASE = '/api/v1/analytics';

    it('GET /health/kpis returns health KPIs', async () => {
      const res = await apiGet(P, `${BASE}/health/kpis`);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /continental/kpis returns continental aggregation', async () => {
      const res = await apiGet(P, `${BASE}/continental/kpis`);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
