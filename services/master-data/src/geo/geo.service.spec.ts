import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GeoService } from './geo.service';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

const mockGeoEntity = {
  id: '00000000-0000-0000-0000-000000000100',
  code: 'KE',
  name: 'Kenya',
  nameEn: 'Kenya',
  nameFr: 'Kenya',
  level: 'COUNTRY',
  parentId: null,
  countryCode: 'KE',
  centroidLat: -0.02,
  centroidLng: 37.91,
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GeoService', () => {
  let service: GeoService;
  let prisma: {
    geoEntity: {
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
      geoEntity: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn() };
    kafkaProducer = { send: vi.fn() };

    service = new GeoService(prisma as any, kafkaProducer as any, audit as any);
  });

  describe('create', () => {
    it('should create a geo entity', async () => {
      prisma.geoEntity.findUnique.mockResolvedValue(null);
      prisma.geoEntity.create.mockResolvedValue(mockGeoEntity);

      const result = await service.create(
        {
          code: 'KE',
          name: 'Kenya',
          nameEn: 'Kenya',
          nameFr: 'Kenya',
          level: 'COUNTRY',
          countryCode: 'KE',
          centroidLat: -0.02,
          centroidLng: 37.91,
        },
        mockUser,
      );

      expect(result.data.code).toBe('KE');
      expect(prisma.geoEntity.create).toHaveBeenCalledOnce();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'GeoEntity' }),
      );
      expect(kafkaProducer.send).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException for duplicate code', async () => {
      prisma.geoEntity.findUnique.mockResolvedValue(mockGeoEntity);

      await expect(
        service.create(
          {
            code: 'KE',
            name: 'Kenya',
            nameEn: 'Kenya',
            nameFr: 'Kenya',
            level: 'COUNTRY',
            countryCode: 'KE',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for invalid parent', async () => {
      prisma.geoEntity.findUnique
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce(null); // parent not found

      await expect(
        service.create(
          {
            code: 'KE-01',
            name: 'Mombasa',
            nameEn: 'Mombasa',
            nameFr: 'Mombasa',
            level: 'ADMIN1',
            parentId: '00000000-0000-0000-0000-999999999999',
            countryCode: 'KE',
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.geoEntity.findMany.mockResolvedValue([mockGeoEntity]);
      prisma.geoEntity.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by level', async () => {
      prisma.geoEntity.findMany.mockResolvedValue([]);
      prisma.geoEntity.count.mockResolvedValue(0);

      await service.findAll({ level: 'COUNTRY' });

      expect(prisma.geoEntity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ level: 'COUNTRY' }),
        }),
      );
    });

    it('should filter by search term', async () => {
      prisma.geoEntity.findMany.mockResolvedValue([]);
      prisma.geoEntity.count.mockResolvedValue(0);

      await service.findAll({ search: 'Ken' });

      expect(prisma.geoEntity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'Ken', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a geo entity by ID', async () => {
      prisma.geoEntity.findUnique.mockResolvedValue(mockGeoEntity);

      const result = await service.findOne(mockGeoEntity.id);
      expect(result.data.code).toBe('KE');
    });

    it('should throw NotFoundException for missing entity', async () => {
      prisma.geoEntity.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and increment version', async () => {
      const updated = { ...mockGeoEntity, name: 'Republic of Kenya', version: 2 };
      prisma.geoEntity.findUnique.mockResolvedValue(mockGeoEntity);
      prisma.geoEntity.update.mockResolvedValue(updated);

      const result = await service.update(
        mockGeoEntity.id,
        { name: 'Republic of Kenya', reason: 'Official name update' },
        mockUser,
      );

      expect(result.data.name).toBe('Republic of Kenya');
      expect(prisma.geoEntity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', reason: 'Official name update' }),
      );
    });

    it('should throw NotFoundException for missing entity', async () => {
      prisma.geoEntity.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'New Name' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findChildren', () => {
    it('should return children of a parent entity', async () => {
      const child = { ...mockGeoEntity, id: 'child-id', code: 'KE-01', level: 'ADMIN1', parentId: mockGeoEntity.id };
      prisma.geoEntity.findUnique.mockResolvedValue(mockGeoEntity);
      prisma.geoEntity.findMany.mockResolvedValue([child]);
      prisma.geoEntity.count.mockResolvedValue(1);

      const result = await service.findChildren(mockGeoEntity.id, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('kafka resilience', () => {
    it('should not fail the request if Kafka publishing fails', async () => {
      prisma.geoEntity.findUnique.mockResolvedValue(null);
      prisma.geoEntity.create.mockResolvedValue(mockGeoEntity);
      kafkaProducer.send.mockRejectedValue(new Error('Kafka unavailable'));

      const result = await service.create(
        {
          code: 'KE',
          name: 'Kenya',
          nameEn: 'Kenya',
          nameFr: 'Kenya',
          level: 'COUNTRY',
          countryCode: 'KE',
        },
        mockUser,
      );

      expect(result.data.code).toBe('KE');
    });
  });
});
