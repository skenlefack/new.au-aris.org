import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { SpeciesService } from './species.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-aris.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const mockSpecies = {
  id: '00000000-0000-0000-0000-000000000200',
  code: 'BOS-TAU',
  scientificName: 'Bos taurus',
  commonNameEn: 'Cattle (taurine)',
  commonNameFr: 'Bovin (taurin)',
  category: 'DOMESTIC',
  productionCategories: ['dairy', 'beef', 'draught'],
  isWoahListed: true,
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SpeciesService', () => {
  let service: SpeciesService;
  let prisma: {
    species: {
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
      species: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn() };
    kafkaProducer = { send: vi.fn() };

    service = new SpeciesService(prisma as any, kafkaProducer as any, audit as any);
  });

  describe('create', () => {
    it('should create a species', async () => {
      prisma.species.findUnique.mockResolvedValue(null);
      prisma.species.create.mockResolvedValue(mockSpecies);

      const result = await service.create(
        {
          code: 'BOS-TAU',
          scientificName: 'Bos taurus',
          commonNameEn: 'Cattle (taurine)',
          commonNameFr: 'Bovin (taurin)',
          category: 'DOMESTIC',
          productionCategories: ['dairy', 'beef'],
          isWoahListed: true,
        },
        mockUser,
      );

      expect(result.data.code).toBe('BOS-TAU');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'Species' }),
      );
    });

    it('should throw ConflictException for duplicate code', async () => {
      prisma.species.findUnique.mockResolvedValue(mockSpecies);

      await expect(
        service.create(
          {
            code: 'BOS-TAU',
            scientificName: 'Bos taurus',
            commonNameEn: 'Cattle',
            commonNameFr: 'Bovin',
            category: 'DOMESTIC',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.species.findMany.mockResolvedValue([mockSpecies]);
      prisma.species.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by category', async () => {
      prisma.species.findMany.mockResolvedValue([]);
      prisma.species.count.mockResolvedValue(0);

      await service.findAll({ category: 'DOMESTIC' });

      expect(prisma.species.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'DOMESTIC' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return species by ID', async () => {
      prisma.species.findUnique.mockResolvedValue(mockSpecies);

      const result = await service.findOne(mockSpecies.id);
      expect(result.data.scientificName).toBe('Bos taurus');
    });

    it('should throw NotFoundException', async () => {
      prisma.species.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and increment version', async () => {
      const updated = { ...mockSpecies, commonNameEn: 'Taurine cattle', version: 2 };
      prisma.species.findUnique.mockResolvedValue(mockSpecies);
      prisma.species.update.mockResolvedValue(updated);

      const result = await service.update(
        mockSpecies.id,
        { commonNameEn: 'Taurine cattle' },
        mockUser,
      );

      expect(result.data.commonNameEn).toBe('Taurine cattle');
      expect(prisma.species.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });
  });
});
