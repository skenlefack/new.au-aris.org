import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmissionService, HttpError } from '../services/submission.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const fieldAgent: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@ke.gov',
  role: UserRole.FIELD_AGENT,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const mockCampaign = {
  id: '00000000-0000-0000-0000-000000000100',
  tenantId: fieldAgent.tenantId,
  templateId: '00000000-0000-0000-0000-000000000200',
  status: 'ACTIVE',
  domain: 'health',
};

const mockSubmission = {
  id: '00000000-0000-0000-0000-000000000300',
  tenantId: fieldAgent.tenantId,
  campaignId: mockCampaign.id,
  templateId: mockCampaign.templateId,
  data: { speciesCode: 'BOV', countryCode: 'KE' },
  submittedBy: fieldAgent.userId,
  submittedAt: new Date(),
  deviceId: 'device-001',
  gpsLat: -1.28,
  gpsLng: 36.82,
  gpsAccuracy: 5.0,
  offlineCreatedAt: null,
  syncedAt: null,
  qualityReportId: null,
  workflowInstanceId: null,
  status: 'SUBMITTED',
  dataClassification: 'RESTRICTED',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SubmissionService', () => {
  let service: SubmissionService;
  let prisma: {
    campaign: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    submission: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    formTemplate: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };
  let kafka: { publish: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } | null;

  beforeEach(() => {
    prisma = {
      campaign: {
        findUnique: vi.fn().mockResolvedValue(mockCampaign),
      },
      submission: {
        create: vi.fn().mockResolvedValue(mockSubmission),
        findMany: vi.fn().mockResolvedValue([mockSubmission]),
        findUnique: vi.fn().mockResolvedValue(mockSubmission),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(mockSubmission),
      },
      formTemplate: {
        findUnique: vi.fn().mockResolvedValue(null), // No template = skip validation
      },
    };
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };
    kafka = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
    };

    service = new SubmissionService(
      prisma as never,
      kafkaProducer as never,
      kafka as never,
    );
  });

  describe('submit', () => {
    const dto = {
      campaignId: mockCampaign.id,
      data: { speciesCode: 'BOV', countryCode: 'KE' },
      deviceId: 'device-001',
      gpsLat: -1.28,
      gpsLng: 36.82,
      gpsAccuracy: 5.0,
    };

    it('should create a submission', async () => {
      const result = await service.submit(dto as any, fieldAgent);

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(mockSubmission.id);
      expect(prisma.submission.create).toHaveBeenCalledOnce();
    });

    it('should request quality validation via Kafka after creating submission', async () => {
      await service.submit(dto as any, fieldAgent);

      expect(kafka!.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.stringContaining('quality'),
          payload: expect.objectContaining({
            recordId: mockSubmission.id,
            entityType: 'Submission',
            domain: 'health',
          }),
        }),
      );
    });

    it('should publish Kafka event', async () => {
      await service.submit(dto as any, fieldAgent);

      expect(kafkaProducer.send).toHaveBeenCalledWith(
        'ms.collecte.form.submitted.v1',
        expect.any(String),
        expect.objectContaining({ campaignId: mockCampaign.id }),
        expect.any(Object),
      );
    });

    it('should throw HttpError when campaign not found', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.submit(dto as any, fieldAgent),
      ).rejects.toThrow(HttpError);
    });

    it('should reject when campaign is not active', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        status: 'COMPLETED',
      });

      await expect(
        service.submit(dto as any, fieldAgent),
      ).rejects.toThrow(HttpError);
    });

    it('should enforce tenant isolation', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        tenantId: 'different-tenant',
      });

      await expect(
        service.submit(dto as any, fieldAgent),
      ).rejects.toThrow(HttpError);
    });

    it('should validate against JSON Schema when template exists', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue({
        schema: {
          type: 'object',
          required: ['speciesCode', 'diseaseCode'],
          properties: {
            speciesCode: { type: 'string' },
            diseaseCode: { type: 'string' },
          },
        },
      });

      // Missing diseaseCode — should fail schema validation
      await expect(
        service.submit(
          { ...dto, data: { speciesCode: 'BOV' } } as any,
          fieldAgent,
        ),
      ).rejects.toThrow(HttpError);
    });

    it('should skip schema validation when template not found', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      const result = await service.submit(dto as any, fieldAgent);
      expect(result.data).toBeDefined();
    });

    it('should proceed gracefully when Kafka publish fails', async () => {
      kafka!.publish.mockRejectedValue(new Error('Kafka down'));

      const result = await service.submit(dto as any, fieldAgent);
      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated submissions', async () => {
      const result = await service.findAll(fieldAgent, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by campaignId, status, agent', async () => {
      await service.findAll(fieldAgent, {
        campaignId: mockCampaign.id,
        status: 'SUBMITTED',
        agent: fieldAgent.userId,
      });

      const call = prisma.submission.findMany.mock.calls[0][0];
      expect(call.where).toHaveProperty('campaignId', mockCampaign.id);
      expect(call.where).toHaveProperty('status', 'SUBMITTED');
      expect(call.where).toHaveProperty('submittedBy', fieldAgent.userId);
    });
  });

  describe('findOne', () => {
    it('should return a submission', async () => {
      const result = await service.findOne(mockSubmission.id, fieldAgent);
      expect(result.data.id).toBe(mockSubmission.id);
    });

    it('should throw HttpError when not found', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', fieldAgent),
      ).rejects.toThrow(HttpError);
    });

    it('should enforce tenant isolation', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        tenantId: 'different-tenant',
      });

      await expect(
        service.findOne(mockSubmission.id, fieldAgent),
      ).rejects.toThrow(HttpError);
    });
  });

  describe('handleQualityResult', () => {
    it('should update submission status to VALIDATED when quality passes', async () => {
      await service.handleQualityResult(
        mockSubmission.id,
        'report-001',
        'PASSED',
        'health',
        fieldAgent.tenantId,
        fieldAgent.userId,
      );

      expect(prisma.submission.update).toHaveBeenCalledWith({
        where: { id: mockSubmission.id },
        data: {
          qualityReportId: 'report-001',
          status: 'VALIDATED',
        },
      });
    });

    it('should update submission status to REJECTED when quality fails', async () => {
      await service.handleQualityResult(
        mockSubmission.id,
        'report-001',
        'FAILED',
        'health',
        fieldAgent.tenantId,
        fieldAgent.userId,
      );

      expect(prisma.submission.update).toHaveBeenCalledWith({
        where: { id: mockSubmission.id },
        data: {
          qualityReportId: 'report-001',
          status: 'REJECTED',
        },
      });
    });

    it('should treat WARNING quality status as passed', async () => {
      await service.handleQualityResult(
        mockSubmission.id,
        'report-001',
        'WARNING',
        'health',
        fieldAgent.tenantId,
        fieldAgent.userId,
      );

      expect(prisma.submission.update).toHaveBeenCalledWith({
        where: { id: mockSubmission.id },
        data: {
          qualityReportId: 'report-001',
          status: 'VALIDATED',
        },
      });
    });

    it('should request workflow creation when quality passes', async () => {
      await service.handleQualityResult(
        mockSubmission.id,
        'report-001',
        'PASSED',
        'health',
        fieldAgent.tenantId,
        fieldAgent.userId,
      );

      expect(kafka!.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.stringContaining('workflow'),
          payload: expect.objectContaining({
            entityType: 'Submission',
            entityId: mockSubmission.id,
          }),
        }),
      );
    });
  });

  describe('handleWorkflowCreated', () => {
    it('should link workflow instance to submission', async () => {
      await service.handleWorkflowCreated(mockSubmission.id, 'wf-001');

      expect(prisma.submission.update).toHaveBeenCalledWith({
        where: { id: mockSubmission.id },
        data: { workflowInstanceId: 'wf-001' },
      });
    });
  });
});
