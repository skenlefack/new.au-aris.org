import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../services/sync.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const fieldAgent: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@ke.gov',
  role: UserRole.FIELD_AGENT,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const activeCampaign = {
  id: '00000000-0000-0000-0000-000000000100',
  tenantId: fieldAgent.tenantId,
  templateId: '00000000-0000-0000-0000-000000000200',
  status: 'ACTIVE',
  domain: 'health',
  conflictStrategy: 'LAST_WRITE_WINS',
};

const manualMergeCampaign = {
  ...activeCampaign,
  id: '00000000-0000-0000-0000-000000000101',
  conflictStrategy: 'MANUAL_MERGE',
};

describe('SyncService', () => {
  let service: SyncService;
  let prisma: {
    campaign: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    submission: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    formTemplate: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    syncLog: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      campaign: {
        findUnique: vi.fn().mockResolvedValue(activeCampaign),
        findMany: vi.fn().mockResolvedValue([]),
      },
      submission: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: data.id ?? 'new-id', ...data }),
        ),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      },
      formTemplate: {
        findUnique: vi.fn().mockResolvedValue(null), // Skip schema validation
      },
      syncLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    service = new SyncService(prisma as never, kafkaProducer as never);
  });

  describe('deltaSync — new submissions', () => {
    it('should accept new submissions', async () => {
      const result = await service.deltaSync(
        {
          submissions: [
            {
              campaignId: activeCampaign.id,
              data: { speciesCode: 'BOV', countryCode: 'KE' },
              deviceId: 'device-001',
            },
          ],
          lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.accepted).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.syncedAt).toBeDefined();
    });

    it('should accept multiple submissions in one batch', async () => {
      const result = await service.deltaSync(
        {
          submissions: [
            { campaignId: activeCampaign.id, data: { field: 'a' } },
            { campaignId: activeCampaign.id, data: { field: 'b' } },
            { campaignId: activeCampaign.id, data: { field: 'c' } },
          ],
          lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.accepted).toHaveLength(3);
      expect(prisma.submission.create).toHaveBeenCalledTimes(3);
    });

    it('should use the provided submission ID if given', async () => {
      const clientId = '00000000-0000-0000-0000-000000000999';
      const result = await service.deltaSync(
        {
          submissions: [
            { id: clientId, campaignId: activeCampaign.id, data: {} },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.accepted).toContain(clientId);
      expect(prisma.submission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: clientId }),
        }),
      );
    });
  });

  describe('deltaSync — rejections', () => {
    it('should reject when campaign not found', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      const result = await service.deltaSync(
        {
          submissions: [
            { campaignId: 'nonexistent', data: {} },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].errors[0].field).toBe('campaignId');
    });

    it('should reject when campaign is not active', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...activeCampaign,
        status: 'COMPLETED',
      });

      const result = await service.deltaSync(
        {
          submissions: [
            { campaignId: activeCampaign.id, data: {} },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].errors[0].message).toContain('not active');
    });

    it('should reject when schema validation fails', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue({
        schema: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      });

      const result = await service.deltaSync(
        {
          submissions: [
            { campaignId: activeCampaign.id, data: {} }, // Missing required 'name'
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.rejected).toHaveLength(1);
    });
  });

  describe('deltaSync — conflict resolution (LAST_WRITE_WINS)', () => {
    const existingSubmission = {
      id: '00000000-0000-0000-0000-000000000500',
      version: 2,
      updatedAt: new Date(),
      status: 'SUBMITTED',
      tenantId: fieldAgent.tenantId,
    };

    it('should resolve conflict: client wins when version >= server', async () => {
      prisma.submission.findUnique.mockResolvedValue(existingSubmission);

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: existingSubmission.id,
              campaignId: activeCampaign.id,
              data: { updatedField: 'new-value' },
              version: 3, // Client version > server version
            },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedBy).toBe('client');
      expect(result.conflicts[0].strategy).toBe('LAST_WRITE_WINS');
      // Client-resolved conflicts are also in accepted
      expect(result.accepted).toContain(existingSubmission.id);
      // Server should have been updated
      expect(prisma.submission.update).toHaveBeenCalledOnce();
    });

    it('should resolve conflict: server wins when client version < server', async () => {
      prisma.submission.findUnique.mockResolvedValue(existingSubmission);

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: existingSubmission.id,
              campaignId: activeCampaign.id,
              data: { staleData: true },
              version: 1, // Client version < server version (2)
            },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedBy).toBe('server');
      // Server wins — no update, not in accepted
      expect(result.accepted).not.toContain(existingSubmission.id);
      expect(prisma.submission.update).not.toHaveBeenCalled();
    });

    it('should resolve conflict: client wins when versions are equal', async () => {
      prisma.submission.findUnique.mockResolvedValue(existingSubmission);

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: existingSubmission.id,
              campaignId: activeCampaign.id,
              data: { updatedField: 'same-version' },
              version: 2, // Same as server
            },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedBy).toBe('client');
      expect(prisma.submission.update).toHaveBeenCalledOnce();
    });
  });

  describe('deltaSync — conflict resolution (MANUAL_MERGE)', () => {
    it('should flag conflict as pending for manual merge', async () => {
      prisma.campaign.findUnique.mockResolvedValue(manualMergeCampaign);
      prisma.submission.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000600',
        version: 1,
        updatedAt: new Date(),
        status: 'SUBMITTED',
      });

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: '00000000-0000-0000-0000-000000000600',
              campaignId: manualMergeCampaign.id,
              data: { field: 'client-value' },
              version: 2,
            },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].strategy).toBe('MANUAL_MERGE');
      expect(result.conflicts[0].resolvedBy).toBe('pending');
      // Not in accepted — requires manual resolution
      expect(result.accepted).not.toContain('00000000-0000-0000-0000-000000000600');
    });
  });

  describe('deltaSync — server updates', () => {
    it('should return campaigns updated since lastSyncAt', async () => {
      const updatedCampaign = {
        id: activeCampaign.id,
        status: 'ACTIVE',
        name: 'Updated Campaign',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        updatedAt: new Date(),
      };
      prisma.campaign.findMany.mockResolvedValue([updatedCampaign]);

      const result = await service.deltaSync(
        {
          submissions: [],
          lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.serverUpdates).toHaveLength(1);
      expect(result.serverUpdates[0].name).toBe('Updated Campaign');
    });
  });

  describe('deltaSync — sync log', () => {
    it('should log sync event to database', async () => {
      await service.deltaSync(
        {
          submissions: [
            { campaignId: activeCampaign.id, data: { field: 'value' } },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(prisma.syncLog.create).toHaveBeenCalledOnce();
      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: fieldAgent.tenantId,
          userId: fieldAgent.userId,
          submissionCount: 1,
          acceptedCount: 1,
          rejectedCount: 0,
          conflictCount: 0,
        }),
      });
    });

    it('should publish sync event to Kafka', async () => {
      await service.deltaSync(
        {
          submissions: [],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(kafkaProducer.send).toHaveBeenCalledWith(
        'ms.collecte.form.synced.v1',
        expect.any(String),
        expect.objectContaining({
          userId: fieldAgent.userId,
          acceptedCount: 0,
        }),
        expect.any(Object),
      );
    });
  });

  describe('deltaSync — mixed batch', () => {
    it('should handle a batch with new, conflict, and rejected submissions', async () => {
      const existingSub = {
        id: '00000000-0000-0000-0000-000000000700',
        version: 3,
        updatedAt: new Date(),
        status: 'SUBMITTED',
      };

      // First call for the existing submission, second for non-existing
      prisma.submission.findUnique
        .mockResolvedValueOnce(existingSub)  // existing → conflict
        .mockResolvedValueOnce(null);        // new → accepted

      // Different campaigns for different submissions
      prisma.campaign.findUnique
        .mockResolvedValueOnce(activeCampaign) // For conflict submission
        .mockResolvedValueOnce(null)           // For rejected submission
        .mockResolvedValueOnce(activeCampaign); // For new submission

      const result = await service.deltaSync(
        {
          submissions: [
            {
              id: existingSub.id,
              campaignId: activeCampaign.id,
              data: { field: 'stale' },
              version: 1, // Stale → server wins
            },
            {
              campaignId: 'nonexistent',
              data: { field: 'invalid' },
            },
            {
              campaignId: activeCampaign.id,
              data: { field: 'new-data' },
            },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedBy).toBe('server');
      expect(result.rejected).toHaveLength(1);
      expect(result.accepted).toHaveLength(1);
    });
  });

  describe('deltaSync — error resilience', () => {
    it('should not throw when Kafka publish fails', async () => {
      kafkaProducer.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.deltaSync(
        {
          submissions: [
            { campaignId: activeCampaign.id, data: {} },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.accepted).toHaveLength(1);
    });

    it('should not throw when sync log creation fails', async () => {
      prisma.syncLog.create.mockRejectedValue(new Error('DB error'));

      const result = await service.deltaSync(
        {
          submissions: [],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result).toBeDefined();
    });

    it('should handle individual submission errors gracefully', async () => {
      prisma.submission.create.mockRejectedValueOnce(new Error('Constraint violation'));

      const result = await service.deltaSync(
        {
          submissions: [
            { campaignId: activeCampaign.id, data: {} },
          ],
          lastSyncAt: new Date().toISOString(),
        } as any,
        fieldAgent,
      );

      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].errors[0].field).toBe('_sync');
    });
  });
});
