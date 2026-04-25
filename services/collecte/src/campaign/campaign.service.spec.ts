import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignService, HttpError } from '../services/campaign.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const adminUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@ke.gov',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const continentalUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000002',
  email: 'admin@au-aris.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000020',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const mockCampaign = {
  id: '00000000-0000-0000-0000-000000000100',
  tenantId: adminUser.tenantId,
  name: 'Kenya FMD Surveillance Q1 2025',
  domain: 'health',
  templateId: '00000000-0000-0000-0000-000000000200',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  targetZones: ['zone-1', 'zone-2'],
  assignedAgents: ['agent-1'],
  targetSubmissions: 100,
  status: 'PLANNED',
  description: 'FMD surveillance',
  conflictStrategy: 'LAST_WRITE_WINS',
  dataContractId: null,
  createdBy: adminUser.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CampaignService', () => {
  let service: CampaignService;
  let prisma: {
    campaign: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    campaignDomainTarget: {
      create: ReturnType<typeof vi.fn>;
    };
    submission: {
      count: ReturnType<typeof vi.fn>;
    };
  };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      campaign: {
        create: vi.fn().mockResolvedValue(mockCampaign),
        findMany: vi.fn().mockResolvedValue([{ ...mockCampaign, targets: [] }]),
        findUnique: vi.fn().mockResolvedValue({ ...mockCampaign, targets: [] }),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue({ ...mockCampaign, status: 'ACTIVE' }),
      },
      campaignDomainTarget: {
        create: vi.fn().mockImplementation((args: { data: { campaignId: string; domainCode: string; subDomainCode: string | null; isPrimary: boolean } }) => {
          return Promise.resolve({
            id: 'target-auto',
            campaignId: args.data.campaignId,
            domainCode: args.data.domainCode,
            subDomainCode: args.data.subDomainCode,
            isPrimary: args.data.isPrimary,
            createdAt: new Date(),
          });
        }),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          level: 'MEMBER_STATE',
          countryCode: 'KE',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      submission: {
        count: vi.fn().mockResolvedValue(0),
      },
    };
    kafkaProducer = { send: vi.fn().mockResolvedValue(undefined) };

    service = new CampaignService(prisma as never, kafkaProducer as never);
  });

  describe('create', () => {
    it('should create a campaign with auto-generated target from legacy domain', async () => {
      const dto = {
        name: 'Kenya FMD Surveillance Q1 2025',
        domain: 'health',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T00:00:00Z',
        targetZones: ['zone-1'],
        assignedAgents: ['agent-1'],
      };

      const result = await service.create(dto as any, adminUser);

      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('Kenya FMD Surveillance Q1 2025');
      expect(result.data.targets).toHaveLength(1);
      expect(result.data.targets![0].domainCode).toBe('health');
      expect(result.data.targets![0].isPrimary).toBe(true);
      expect(kafkaProducer.send).toHaveBeenCalledOnce();
    });

    it('should create a campaign with explicit multi-targets', async () => {
      const dto = {
        name: 'Cross-Domain Campaign',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T00:00:00Z',
        targets: [
          { domainCode: 'livestock-prod', isPrimary: true },
          { domainCode: 'trade-sps', subDomainCode: 'DAIRY_TRADE', isPrimary: false },
        ],
      };

      const result = await service.create(dto as any, adminUser);

      expect(result.data).toBeDefined();
      expect(result.data.targets).toHaveLength(2);
      expect(result.data.targets![0].domainCode).toBe('livestock-prod');
      expect(result.data.targets![0].isPrimary).toBe(true);
      expect(result.data.targets![1].domainCode).toBe('trade-sps');
      expect(result.data.targets![1].subDomainCode).toBe('DAIRY_TRADE');
      // Legacy domain = primary target's domainCode
      expect(prisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ domain: 'livestock-prod' }),
        }),
      );
    });

    it('should throw when neither domain nor targets provided', async () => {
      const dto = {
        name: 'No domain',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T00:00:00Z',
      };

      await expect(service.create(dto as any, adminUser)).rejects.toThrow(HttpError);
    });

    it('should throw when multiple targets without exactly 1 primary', async () => {
      const dto = {
        name: 'Bad targets',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T00:00:00Z',
        targets: [
          { domainCode: 'health', isPrimary: true },
          { domainCode: 'trade-sps', isPrimary: true },
        ],
      };

      await expect(service.create(dto as any, adminUser)).rejects.toThrow(HttpError);
    });

    it('should reject when endDate is before startDate', async () => {
      const dto = {
        name: 'Bad dates',
        domain: 'health',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-06-01T00:00:00Z',
        endDate: '2025-01-01T00:00:00Z',
        targetZones: [],
        assignedAgents: [],
      };

      await expect(service.create(dto as any, adminUser)).rejects.toThrow(
        HttpError,
      );
    });

    it('should not throw when Kafka fails (best-effort)', async () => {
      kafkaProducer.send.mockRejectedValue(new Error('Kafka down'));

      const dto = {
        name: 'Test',
        domain: 'health',
        templateId: '00000000-0000-0000-0000-000000000200',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T00:00:00Z',
        targetZones: [],
        assignedAgents: [],
      };

      const result = await service.create(dto as any, adminUser);
      expect(result.data).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated campaigns', async () => {
      const result = await service.findAll(adminUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by tenant for MS users', async () => {
      await service.findAll(adminUser, {});

      const call = prisma.campaign.findMany.mock.calls[0][0];
      // MS users see own campaigns OR campaigns targeting their country
      expect(call.where).toHaveProperty('OR');
      expect(call.where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tenantId: adminUser.tenantId }),
        ]),
      );
    });

    it('should not filter by tenant for continental users', async () => {
      await service.findAll(continentalUser, {});

      const call = prisma.campaign.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('tenantId');
    });

    it('should apply domain, status, zone filters', async () => {
      await service.findAll(continentalUser, {
        domain: 'health',
        status: 'ACTIVE',
        zone: 'zone-1',
      });

      const call = prisma.campaign.findMany.mock.calls[0][0];
      expect(call.where).toHaveProperty('domain', 'health');
      expect(call.where).toHaveProperty('status', 'ACTIVE');
      expect(call.where).toHaveProperty('targetZones', { has: 'zone-1' });
    });
  });

  describe('multi-target filtering', () => {
    it('should filter campaigns by domainCode via targets join', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);

      await service.findAll(continentalUser, {
        domainCode: 'livestock-prod',
      });

      const call = prisma.campaign.findMany.mock.calls[0][0];
      expect(call.where).toHaveProperty('targets', {
        some: { domainCode: 'livestock-prod' },
      });
    });

    it('should filter campaigns by domainCode and subDomainCode', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);

      await service.findAll(continentalUser, {
        domainCode: 'trade-sps',
        subDomainCode: 'DAIRY_TRADE',
      });

      const call = prisma.campaign.findMany.mock.calls[0][0];
      expect(call.where).toHaveProperty('targets', {
        some: { domainCode: 'trade-sps', subDomainCode: 'DAIRY_TRADE' },
      });
    });

    it('should include targets in findAll response', async () => {
      prisma.campaign.findMany.mockResolvedValue([{
        ...mockCampaign,
        targets: [
          { id: 't1', campaignId: mockCampaign.id, domainCode: 'health', subDomainCode: null, isPrimary: true, createdAt: new Date() },
        ],
      }]);
      prisma.campaign.count.mockResolvedValue(1);

      const result = await service.findAll(continentalUser, {});

      expect(result.data[0].targets).toHaveLength(1);
      expect(result.data[0].targets![0].domainCode).toBe('health');
    });
  });

  describe('findOne', () => {
    it('should return campaign with progress stats', async () => {
      prisma.submission.count
        .mockResolvedValueOnce(25)  // total
        .mockResolvedValueOnce(15)  // validated
        .mockResolvedValueOnce(3);  // rejected

      const result = await service.findOne(mockCampaign.id, adminUser);

      expect(result.data.id).toBe(mockCampaign.id);
      expect(result.data.progress).toBeDefined();
      expect(result.data.progress.totalSubmissions).toBe(25);
      expect(result.data.progress.validated).toBe(15);
      expect(result.data.progress.rejected).toBe(3);
      expect(result.data.progress.pending).toBe(7);
    });

    it('should throw HttpError when not found', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', adminUser),
      ).rejects.toThrow(HttpError);
    });

    it('should enforce tenant isolation for MS users', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        tenantId: 'different-tenant',
      });

      await expect(
        service.findOne(mockCampaign.id, adminUser),
      ).rejects.toThrow(HttpError);
    });
  });

  describe('update', () => {
    it('should update campaign fields', async () => {
      const result = await service.update(
        mockCampaign.id,
        { name: 'Updated Campaign' },
        adminUser,
      );

      expect(result.data).toBeDefined();
      expect(prisma.campaign.update).toHaveBeenCalledOnce();
    });

    it('should allow valid status transitions', async () => {
      // PLANNED → ACTIVE is valid
      await service.update(
        mockCampaign.id,
        { status: 'ACTIVE' },
        adminUser,
      );

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: mockCampaign.id },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      });
    });

    it('should reject invalid status transitions', async () => {
      // PLANNED → COMPLETED is not valid
      await expect(
        service.update(mockCampaign.id, { status: 'COMPLETED' }, adminUser),
      ).rejects.toThrow(HttpError);
    });

    it('should reject transitions from COMPLETED', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        status: 'COMPLETED',
      });

      await expect(
        service.update(mockCampaign.id, { status: 'ACTIVE' }, adminUser),
      ).rejects.toThrow(HttpError);
    });

    it('should throw HttpError when not found', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' }, adminUser),
      ).rejects.toThrow(HttpError);
    });
  });
});
