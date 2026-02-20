import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { PrismaService } from '../prisma.service';
import { KafkaProducerService } from '@aris/kafka-client';
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
    };
    formTemplate: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      campaign: {
        findUnique: vi.fn().mockResolvedValue(mockCampaign),
      },
      submission: {
        create: vi.fn().mockResolvedValue(mockSubmission),
        findMany: vi.fn().mockResolvedValue([mockSubmission]),
        findUnique: vi.fn().mockResolvedValue(mockSubmission),
        count: vi.fn().mockResolvedValue(1),
      },
      formTemplate: {
        findUnique: vi.fn().mockResolvedValue(null), // No template = skip validation
      },
    };
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        SubmissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: KafkaProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get(SubmissionService);
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
