import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RuleService } from './rule.service';
import { PrismaService } from '../prisma.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'steward@au-ibar.org',
  role: UserRole.DATA_STEWARD,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const continentalUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000002',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000020',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const mockRule = {
  id: '00000000-0000-0000-0000-000000000100',
  domain: 'health',
  entityType: 'Outbreak',
  tenantId: mockUser.tenantId,
  name: 'Require disease code',
  description: 'Disease code must be present for outbreaks',
  gate: 'COMPLETENESS',
  config: { requiredFields: ['diseaseCode'] },
  isActive: true,
  createdBy: mockUser.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RuleService', () => {
  let service: RuleService;
  let prisma: {
    customQualityRule: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      customQualityRule: {
        create: vi.fn().mockResolvedValue(mockRule),
        findMany: vi.fn().mockResolvedValue([mockRule]),
        findUnique: vi.fn().mockResolvedValue(mockRule),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue({ ...mockRule, name: 'Updated name' }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        RuleService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RuleService);
  });

  describe('create', () => {
    it('should create a custom quality rule', async () => {
      const dto = {
        domain: 'health',
        entityType: 'Outbreak',
        name: 'Require disease code',
        gate: 'COMPLETENESS',
        config: { requiredFields: ['diseaseCode'] },
      };

      const result = await service.create(dto as any, mockUser);

      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('Require disease code');
      expect(prisma.customQualityRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          domain: 'health',
          entityType: 'Outbreak',
          tenantId: mockUser.tenantId,
          createdBy: mockUser.userId,
        }),
      });
    });

    it('should default isActive to true', async () => {
      const dto = {
        domain: 'health',
        entityType: 'Outbreak',
        name: 'Test rule',
        gate: 'COMPLETENESS',
        config: {},
      };

      await service.create(dto as any, mockUser);

      expect(prisma.customQualityRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: true }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated rules with tenant isolation', async () => {
      const result = await service.findAll(mockUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });

      const findManyCall = prisma.customQualityRule.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('isActive', true);
    });

    it('should filter by domain and entityType', async () => {
      await service.findAll(mockUser, { domain: 'health', entityType: 'Outbreak' });

      const findManyCall = prisma.customQualityRule.findMany.mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('domain', 'health');
      expect(findManyCall.where).toHaveProperty('entityType', 'Outbreak');
    });

    it('should not filter by tenantId for continental users', async () => {
      await service.findAll(continentalUser, {});

      const findManyCall = prisma.customQualityRule.findMany.mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('tenantId');
    });
  });

  describe('findOne', () => {
    it('should return a single rule', async () => {
      const result = await service.findOne(mockRule.id);

      expect(result.data.id).toBe(mockRule.id);
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      prisma.customQualityRule.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a rule', async () => {
      const result = await service.update(mockRule.id, { name: 'Updated name' });

      expect(result.data.name).toBe('Updated name');
      expect(prisma.customQualityRule.update).toHaveBeenCalledWith({
        where: { id: mockRule.id },
        data: expect.objectContaining({ name: 'Updated name' }),
      });
    });

    it('should throw NotFoundException if rule does not exist', async () => {
      prisma.customQualityRule.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only update provided fields', async () => {
      await service.update(mockRule.id, { isActive: false });

      const updateCall = prisma.customQualityRule.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('isActive', false);
      expect(updateCall.data).not.toHaveProperty('name');
    });
  });
});
