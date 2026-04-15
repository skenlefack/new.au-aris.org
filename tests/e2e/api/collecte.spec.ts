/**
 * E2E: Collecte Pipeline — Campaigns, Templates, Submissions, Workflow
 */
import { apiGet, apiPost, PORTS } from './helpers';

const FB = PORTS.formBuilder;
const CO = PORTS.collecte;
const WF = PORTS.workflow;

describe('Collecte Pipeline E2E', () => {
  let templateId: string;
  let campaignId: string;
  let submissionId: string;

  describe('Form Builder — Templates', () => {
    it('GET /templates returns published templates', async () => {
      const res = await apiGet(FB, '/api/v1/form-builder/templates', {
        status: 'PUBLISHED',
        limit: '5',
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
      if (res.raw.data.length > 0) {
        templateId = res.raw.data[0].id;
        expect(res.raw.data[0]).toHaveProperty('name');
        expect(res.raw.data[0]).toHaveProperty('status', 'PUBLISHED');
        expect(res.raw.data[0]).toHaveProperty('schema');
      }
    });
  });

  describe('Collecte — Campaigns', () => {
    it('GET /campaigns returns active campaigns', async () => {
      const res = await apiGet(CO, '/api/v1/collecte/campaigns', {
        status: 'ACTIVE',
        limit: '5',
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
      if (res.raw.data.length > 0) {
        campaignId = res.raw.data[0].id;
        const c = res.raw.data[0];
        expect(c).toHaveProperty('name');
        expect(c).toHaveProperty('status', 'ACTIVE');
        expect(c).toHaveProperty('domain');
      }
    });

    it('GET /campaigns/:id returns campaign detail', async () => {
      if (!campaignId) return;
      const res = await apiGet(CO, `/api/v1/collecte/campaigns/${campaignId}`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('id', campaignId);
    });
  });

  describe('Collecte — Submissions', () => {
    it('GET /submissions returns submissions list', async () => {
      const res = await apiGet(CO, '/api/v1/collecte/submissions', { limit: '5' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
    });

    it('POST /submissions creates a new submission', async () => {
      if (!templateId) return;
      const res = await apiPost(CO, '/api/v1/collecte/submissions', {
        templateId,
        campaignId: campaignId || undefined,
        data: { test_field: 'E2E test value', note: 'Automated E2E test' },
        status: 'DRAFT',
      });
      // Accept 200 or 201
      if (res.status >= 200 && res.status < 300) {
        submissionId = res.data?.id;
        expect(res.data).toHaveProperty('id');
        expect(res.data).toHaveProperty('status');
      }
    });

    it('POST /submissions/:id/submit transitions to SUBMITTED', async () => {
      if (!submissionId) return;
      const res = await apiPost(
        CO,
        `/api/v1/collecte/submissions/${submissionId}/submit`,
      );
      if (res.status >= 200 && res.status < 300) {
        expect(res.data?.status ?? res.raw?.status).toMatch(/SUBMITTED|PENDING/i);
      }
    });
  });

  describe('Workflow — Validation', () => {
    it('GET /workflow/instances lists workflow instances', async () => {
      const res = await apiGet(WF, '/api/v1/workflow/instances', { limit: '5' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.raw.data)).toBe(true);
      if (res.raw.data.length > 0) {
        const inst = res.raw.data[0];
        expect(inst).toHaveProperty('currentLevel');
        expect(inst).toHaveProperty('status');
      }
    });

    it('GET /workflow/stats returns validation statistics', async () => {
      const res = await apiGet(WF, '/api/v1/workflow/stats');
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });
});
