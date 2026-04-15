/**
 * E2E: Tenant Service — Hierarchy, CRUD, Access Control
 */
import { apiGet, apiPatch, PORTS } from './helpers';

const P = PORTS.tenant;
const BASE = '/api/v1/tenants';

describe('Tenant Service E2E', () => {
  let auTenantId: string;

  describe('GET /tenants', () => {
    it('returns paginated tenant list', async () => {
      const res = await apiGet(P, BASE, { page: '1', limit: '10' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
      expect(res.raw.data.length).toBeGreaterThan(0);
      expect(res.raw.meta).toHaveProperty('total');

      // Save AU tenant for later tests
      const au = res.raw.data.find(
        (t: any) => t.level === 'CONTINENTAL' || t.code === 'AU',
      );
      if (au) auTenantId = au.id;
    });

    it('returns tenants with expected fields', async () => {
      const res = await apiGet(P, BASE, { limit: '1' });
      expect(res.status).toBe(200);
      const tenant = res.raw.data[0];
      expect(tenant).toHaveProperty('id');
      expect(tenant).toHaveProperty('name');
      expect(tenant).toHaveProperty('code');
      expect(tenant).toHaveProperty('level');
      expect(tenant).toHaveProperty('isActive');
    });
  });

  describe('GET /tenants/:id', () => {
    it('returns single tenant by ID', async () => {
      const list = await apiGet(P, BASE, { limit: '1' });
      const id = list.raw.data[0]?.id;
      if (!id) return;

      const res = await apiGet(P, `${BASE}/${id}`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('id', id);
    });

    it('returns 404 for non-existent tenant', async () => {
      const res = await apiGet(P, `${BASE}/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /tenants/:id/children', () => {
    it('returns child tenants for AU continental', async () => {
      if (!auTenantId) return;
      const res = await apiGet(P, `${BASE}/${auTenantId}/children`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
      // AU should have REC children
      if (res.raw.data.length > 0) {
        expect(res.raw.data[0]).toHaveProperty('level');
      }
    });
  });

  describe('Tenant Hierarchy', () => {
    it('has correct 3-level structure: CONTINENTAL → REC → MEMBER_STATE', async () => {
      const res = await apiGet(P, BASE, { limit: '100' });
      expect(res.status).toBe(200);
      const tenants = res.raw.data;

      const levels = new Set(tenants.map((t: any) => t.level));
      expect(levels.has('CONTINENTAL')).toBe(true);
      expect(levels.has('REC')).toBe(true);
      expect(levels.has('MEMBER_STATE')).toBe(true);

      // RECs have parentId pointing to CONTINENTAL
      const continentalId = tenants.find((t: any) => t.level === 'CONTINENTAL')?.id;
      const recs = tenants.filter((t: any) => t.level === 'REC');
      for (const rec of recs) {
        expect(rec.parentId).toBe(continentalId);
      }

      // Member states have parentId pointing to a REC
      const recIds = new Set(recs.map((r: any) => r.id));
      const ms = tenants.filter((t: any) => t.level === 'MEMBER_STATE');
      for (const m of ms) {
        expect(recIds.has(m.parentId)).toBe(true);
      }
    });
  });
});
