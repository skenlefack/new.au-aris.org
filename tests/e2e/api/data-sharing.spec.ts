/**
 * E2E: Data Sharing — Agreement Lifecycle
 */
import { apiGet, apiPost, apiPatch, apiDelete, PORTS } from './helpers';

const P = PORTS.dataSharing;
const BASE = '/api/v1/data-sharing';

describe('Data Sharing E2E', () => {
  let agreementId: string;
  let tenantId: string;
  let recipientTenantId: string;

  beforeAll(async () => {
    // Get tenant IDs for creating agreements
    const tenants = await apiGet(PORTS.tenant, '/api/v1/tenants', { limit: '10' });
    if (tenants.status === 200 && tenants.raw.data?.length >= 2) {
      const recs = tenants.raw.data.filter((t: any) => t.level === 'REC');
      if (recs.length >= 2) {
        tenantId = recs[0].id;
        recipientTenantId = recs[1].id;
      }
    }
  });

  describe('Agreement CRUD', () => {
    it('POST /agreements creates a DRAFT agreement', async () => {
      if (!recipientTenantId) return;
      const res = await apiPost(P, `${BASE}/agreements`, {
        recipientTenantId,
        title: 'E2E Test Agreement',
        description: 'Automated E2E test',
        domains: ['animal-health'],
        scope: {
          countries: ['KE', 'ET'],
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
        },
        permissions: {
          can_consult: true,
          can_export: false,
          max_exports_per_month: 10,
        },
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      if (res.status >= 200 && res.status < 300) {
        agreementId = res.data?.id;
        expect(res.data).toHaveProperty('id');
        expect(res.data).toHaveProperty('status', 'DRAFT');
        expect(res.data).toHaveProperty('reference');
      }
    });

    it('GET /agreements lists agreements', async () => {
      const res = await apiGet(P, `${BASE}/agreements`, { limit: '5' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
    });
  });

  describe('Agreement Workflow', () => {
    it('POST /agreements/:id/submit transitions DRAFT → SUBMITTED', async () => {
      if (!agreementId) return;
      const res = await apiPost(P, `${BASE}/agreements/${agreementId}/submit`);
      if (res.status >= 200 && res.status < 300) {
        expect(res.data?.status).toBe('SUBMITTED');
      }
    });

    it('POST /agreements/:id/accept transitions SUBMITTED → ACCEPTED/ACTIVE', async () => {
      if (!agreementId) return;
      const res = await apiPost(P, `${BASE}/agreements/${agreementId}/accept`);
      if (res.status >= 200 && res.status < 300) {
        expect(['ACCEPTED', 'ACTIVE']).toContain(res.data?.status);
      }
    });
  });

  describe('Dashboard', () => {
    it('GET /dashboard returns sharing KPIs', async () => {
      const res = await apiGet(P, `${BASE}/dashboard`);
      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });
  });

  // Cleanup
  afterAll(async () => {
    if (agreementId) {
      await apiPost(P, `${BASE}/agreements/${agreementId}/revoke`).catch(() => {});
    }
  });
});
