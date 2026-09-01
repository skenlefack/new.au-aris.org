/**
 * E2E: GeoZones — domain-specific geographic zones (master-data service)
 */
import { apiGet, apiPost, apiDelete, PORTS } from './helpers';

const P = PORTS.masterData;
const BASE = '/api/v1/master-data/geo-zones';

describe('GeoZones E2E', () => {
  let createdZoneId: string | null = null;

  // ── List ──
  it('GET /geo-zones returns zone list', async () => {
    const res = await apiGet(P, BASE);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('GET /geo-zones?countryCode=KE filters by country', async () => {
    const res = await apiGet(P, BASE, { countryCode: 'KE' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    for (const z of res.data) {
      expect(z.countryCode).toBe('KE');
    }
  });

  it('GET /geo-zones?domainCode=animal-health filters by domain', async () => {
    const res = await apiGet(P, BASE, { domainCode: 'animal-health' });
    expect(res.status).toBe(200);
    for (const z of res.data) {
      expect(z.domainCode).toBe('animal-health');
    }
  });

  // ── Create ──
  it('POST /geo-zones creates a new zone', async () => {
    // First, get a valid ADMIN1 entity for KE
    const geoRes = await apiGet(P, '/api/v1/master-data/geo', {
      countryCode: 'KE',
      level: 'ADMIN1',
      limit: '3',
    });
    expect(geoRes.status).toBe(200);
    const admin1Ids = geoRes.data.map((e: any) => e.id);
    expect(admin1Ids.length).toBeGreaterThan(0);

    const payload = {
      countryCode: 'KE',
      domainCode: 'animal-health',
      code: `E2E_TEST_ZONE_${Date.now()}`,
      name: { en: 'E2E Test Zone', fr: 'Zone de test E2E' },
      description: { en: 'Created by E2E test suite' },
      memberIds: admin1Ids.slice(0, 2),
      sortOrder: 99,
    };

    const res = await apiPost(P, BASE, payload);
    expect(res.status).toBe(201);
    expect(res.data).toBeDefined();
    expect(res.data.code).toBe(payload.code);
    expect(res.data.countryCode).toBe('KE');
    expect(res.data.domainCode).toBe('animal-health');
    expect(res.data.memberIds).toHaveLength(admin1Ids.slice(0, 2).length);

    createdZoneId = res.data.id;
  });

  // ── Get by ID ──
  it('GET /geo-zones/:id returns the zone', async () => {
    if (!createdZoneId) return;
    const res = await apiGet(P, `${BASE}/${createdZoneId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdZoneId);
  });

  // ── Validation: invalid memberIds ──
  it('POST /geo-zones rejects invalid memberIds', async () => {
    const payload = {
      countryCode: 'KE',
      domainCode: 'livestock',
      code: `E2E_BAD_ZONE_${Date.now()}`,
      name: { en: 'Bad Zone' },
      memberIds: ['00000000-0000-0000-0000-000000000000'],
      sortOrder: 0,
    };

    const res = await apiPost(P, BASE, payload);
    expect(res.status).toBe(400);
  });

  // ── Delete ──
  it('DELETE /geo-zones/:id removes the zone', async () => {
    if (!createdZoneId) return;
    const res = await apiDelete(P, `${BASE}/${createdZoneId}`);
    expect(res.status).toBe(200);

    // Verify it's gone
    const getRes = await apiGet(P, `${BASE}/${createdZoneId}`);
    expect(getRes.status).toBe(404);
  });

  // ── Zone KPIs (analytics) ──
  describe('Zone KPIs', () => {
    it('GET /analytics/zones/:zoneId/kpis returns KPI data', async () => {
      // Get a seeded zone first
      const zonesRes = await apiGet(P, BASE, { countryCode: 'KE', domainCode: 'animal-health' });
      if (!zonesRes.data || zonesRes.data.length === 0) {
        console.log('No seeded zones found — skipping KPI test');
        return;
      }

      const zone = zonesRes.data[0];
      const kpiRes = await apiGet(PORTS.analytics, `/api/v1/analytics/zones/${zone.id}/kpis`, {
        memberIds: (zone.memberIds || []).join(','),
      });
      expect(kpiRes.status).toBe(200);
      expect(kpiRes.data).toBeDefined();
      expect(typeof kpiRes.data.totalSubmissions).toBe('number');
    });
  });
});
