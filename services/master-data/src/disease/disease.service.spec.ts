import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DiseaseService } from './disease.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const mockDisease = {
  id: '00000000-0000-0000-0000-000000000300',
  code: 'FMD',
  nameEn: 'Foot and mouth disease',
  nameFr: 'Fièvre aphteuse',
  isWoahListed: true,
  affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR'],
  isNotifiable: true,
  wahisCategory: 'multiple_species',
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DiseaseService', () => {
  let service: DiseaseService;
  let prisma: {
    disease: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      disease: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn() };
    kafkaProducer = { send: vi.fn() };

    service = new DiseaseService(prisma as any, kafkaProducer as any, audit as any);
  });

  describe('create', () => {
    it('should create a disease', async () => {
      prisma.disease.findUnique.mockResolvedValue(null);
      prisma.disease.create.mockResolvedValue(mockDisease);

      const result = await service.create(
        {
          code: 'FMD',
          nameEn: 'Foot and mouth disease',
          nameFr: 'Fièvre aphteuse',
          isWoahListed: true,
          affectedSpecies: ['BOS-TAU'],
          isNotifiable: true,
          wahisCategory: 'multiple_species',
        },
        mockUser,
      );

      expect(result.data.code).toBe('FMD');
      expect(audit.log).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException for duplicate code', async () => {
      prisma.disease.findUnique.mockResolvedValue(mockDisease);

      await expect(
        service.create(
          { code: 'FMD', nameEn: 'FMD', nameFr: 'FA' },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should filter by isWoahListed', async () => {
      prisma.disease.findMany.mockResolvedValue([mockDisease]);
      prisma.disease.count.mockResolvedValue(1);

      const result = await service.findAll({ isWoahListed: true });

      expect(result.data).toHaveLength(1);
      expect(prisma.disease.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isWoahListed: true }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update affected species and increment version', async () => {
      const updated = {
        ...mockDisease,
        affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR', 'SUS-DOM'],
        version: 2,
      };
      prisma.disease.findUnique.mockResolvedValue(mockDisease);
      prisma.disease.update.mockResolvedValue(updated);

      const result = await service.update(
        mockDisease.id,
        { affectedSpecies: ['BOS-TAU', 'OVI-ARI', 'CAP-HIR', 'SUS-DOM'] },
        mockUser,
      );

      expect(result.data.affectedSpecies).toHaveLength(4);
    });
  });
});
