import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubmissionService } from './submission.service';
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

const mockQualityReport = {
  id: 'qr-001',
  recordId: mockSubmission.id,
  entityType: 'Submission',
  domain: 'health',
  tenantId: fieldAgent.tenantId,
  overallStatus: 'PASSED' as const,
  totalDurationMs: 42,
  checkedAt: new Date().toISOString(),
};

const mockWorkflowInstance = {
  id: 'wf-001',
  tenantId: fieldAgent.tenantId,
  entityType: 'Submission',
  entityId: mockSubmission.id,
  domain: 'health',
  currentLevel: 'NATIONAL_TECHNICAL',
  status: 'PENDING',
  wahisReady: false,
  analyticsReady: false,
  createdAt: new Date().toISOString(),
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
  let dataQualityClient: { validate: ReturnType<typeof vi.fn> };
  let workflowClient: { createInstance: ReturnType<typeof vi.fn> };

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
    dataQualityClient = {
      validate: vi.fn().mockResolvedValue({
        status: 200,
        data: { data: mockQualityReport },
        headers: {},
      }),
    };
    workflowClient = {
      createInstance: vi.fn().mockResolvedValue({
        status: 201,
        data: { data: mockWorkflowInstance },
        headers: {},
      }),
    };

    service = new SubmissionService(
      prisma as never,
      kafkaProducer as never,
      dataQualityClient as never,
      workflowClient as never,
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

    it('should call data quality validation after creating submission', async () => {
      await service.submit(dto as any, fieldAgent);

      expect(dataQualityClient.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: mockSubmission.id,
          entityType: 'Submission',
          domain: 'health',
        }),
        fieldAgent.tenantId,
      );
    });

    it('should create workflow instance when quality passes', async () => {
      await service.submit(dto as any, fieldAgent);

      expect(workflowClient.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Submission',
          entityId: mockSubmission.id,
          domain: 'health',
          qualityReportId: 'qr-001',
        }),
        fieldAgent.tenantId,
      );
    });

    it('should NOT create workflow when quality fails', async () => {
      dataQualityClient.validate.mockResolvedValue({
        status: 200,
        data: { data: { ...mockQualityReport, overallStatus: 'FAILED' } },
        headers: {},
      });

      await service.submit(dto as any, fieldAgent);

      expect(workflowClient.createInstance).not.toHaveBeenCalled();
      // Should update status to REJECTED
      expect(prisma.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        }),
      );
    });

    it('should proceed gracefully when quality service is unavailable', async () => {
      dataQualityClient.validate.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.submit(dto as any, fieldAgent);

      expect(result.data).toBeDefined();
      // Should still create workflow (graceful degradation)
      expect(workflowClient.createInstance).toHaveBeenCalled();
    });

    it('should proceed gracefully when workflow service is unavailable', async () => {
      workflowClient.createInstance.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.submit(dto as any, fieldAgent);

      expect(result.data).toBeDefined();
      // Should not throw — logs warning
    });

    it('should store qualityReportId on submission after quality check', async () => {
      await service.submit(dto as any, fieldAgent);

      expect(prisma.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmission.id },
          data: expect.objectContaining({ qualityReportId: 'qr-001' }),
        }),
      );
    });

    it('should store workflowInstanceId on submission after workflow creation', async () => {
      await service.submit(dto as any, fieldAgent);

      expect(prisma.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmission.id },
          data: expect.objectContaining({ workflowInstanceId: 'wf-001' }),
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

    it('should throw NotFoundException when campaign not found', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.submit(dto as any, fieldAgent),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when campaign is not active', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        status: 'COMPLETED',
      });

      await expect(
        service.submit(dto as any, fieldAgent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce tenant isolation', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        tenantId: 'different-tenant',
      });

      await expect(
        service.submit(dto as any, fieldAgent),
      ).rejects.toThrow(NotFoundException);
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
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip schema validation when template not found', async () => {
      prisma.formTemplate.findUnique.mockResolvedValue(null);

      const result = await service.submit(dto as any, fieldAgent);
      expect(result.data).toBeDefined();
    });

    it('should publish rejection event when quality fails', async () => {
      dataQualityClient.validate.mockResolvedValue({
        status: 200,
        data: { data: { ...mockQualityReport, overallStatus: 'FAILED' } },
        headers: {},
      });

      await service.submit(dto as any, fieldAgent);

      expect(kafkaProducer.send).toHaveBeenCalledWith(
        'au.quality.record.rejected.v1',
        mockSubmission.id,
        expect.objectContaining({
          submissionId: mockSubmission.id,
          overallStatus: 'FAILED',
        }),
        expect.any(Object),
      );
    });

    it('should treat WARNING quality status as passed', async () => {
      dataQualityClient.validate.mockResolvedValue({
        status: 200,
        data: { data: { ...mockQualityReport, overallStatus: 'WARNING' } },
        headers: {},
      });

      await service.submit(dto as any, fieldAgent);

      expect(workflowClient.createInstance).toHaveBeenCalled();
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

    it('should throw NotFoundException when not found', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', fieldAgent),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        tenantId: 'different-tenant',
      });

      await expect(
        service.findOne(mockSubmission.id, fieldAgent),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
