import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TenantService } from '../tenant.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrismaService() {
  return {
    tenant: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
}

function mockKafkaProducer() {
  return {
    send: vi.fn().mockResolvedValue([]),
  };
}

function continentalUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@aris.africa',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function recUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-igad',
    email: 'coord@igad.aris.africa',
    role: UserRole.REC_ADMIN,
    tenantId: 'tenant-igad',
    tenantLevel: TenantLevel.REC,
    ...overrides,
  };
}

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'admin@ke.aris.africa',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function tenantFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-ke',
    name: 'Republic of Kenya',
    code: 'KE',
    level: TenantLevel.MEMBER_STATE,
    parentId: 'tenant-igad',
    countryCode: 'KE',
    recCode: 'IGAD',
    domain: 'ke.aris.africa',
    config: {},
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('TenantService', () => {
  let service: TenantService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    service = new TenantService(prisma as never, kafka as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a tenant and publish Kafka event', async () => {
      const dto = {
        name: 'Republic of Kenya',
        code: 'KE',
        level: TenantLevel.MEMBER_STATE,
        parentId: 'tenant-igad',
        countryCode: 'KE',
        recCode: 'IGAD',
        domain: 'ke.aris.africa',
      };

      prisma.tenant.findUnique
        .mockResolvedValueOnce(null)         // code check: no duplicate
        .mockResolvedValueOnce({ id: 'tenant-igad' }); // parent exists
      prisma.tenant.create.mockResolvedValue(tenantFixture());

      const result = await service.create(dto, continentalUser());

      expect(result.data).toEqual(tenantFixture());
      expect(prisma.tenant.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.tenant.created.v1',
        'tenant-ke',
        expect.objectContaining({ code: 'KE' }),
        expect.objectContaining({ sourceService: 'tenant-service' }),
      );
    });

    it('should throw ConflictException if code already exists', async () => {
      prisma.tenant.findUnique.mockResolvedValueOnce(tenantFixture());

      await expect(
        service.create(
          { name: 'Dup', code: 'KE', level: TenantLevel.MEMBER_STATE, domain: 'dup.aris.africa' },
          continentalUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if parentId does not exist', async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(null)   // code check: no duplicate
        .mockResolvedValueOnce(null);  // parent not found

      await expect(
        service.create(
          { name: 'Test', code: 'XX', level: TenantLevel.MEMBER_STATE, parentId: 'nonexistent', domain: 'xx.aris.africa' },
          continentalUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(tenantFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        { name: 'Test', code: 'KE', level: TenantLevel.MEMBER_STATE, domain: 'ke.aris.africa' },
        continentalUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return all tenants for CONTINENTAL user', async () => {
      const tenants = [tenantFixture()];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.findAll(continentalUser(), {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      // CONTINENTAL should pass empty where clause
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter to own + children for REC user', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.findAll(recUser(), {});

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { id: 'tenant-igad' },
              { parentId: 'tenant-igad' },
            ],
          },
        }),
      );
    });

    it('should filter to own tenant only for MEMBER_STATE user', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.findAll(msUser(), {});

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-ke' },
        }),
      );
    });

    it('should respect pagination parameters', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(50);

      const result = await service.findAll(continentalUser(), {
        page: 3,
        limit: 10,
        sort: 'name',
        order: 'desc',
      });

      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10 });
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
          orderBy: { name: 'desc' },
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 });

      expect(result.meta.limit).toBe(100);
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return a tenant by ID', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenantFixture());

      const result = await service.findOne('tenant-ke', continentalUser());

      expect(result.data.code).toBe('KE');
    });

    it('should throw NotFoundException for nonexistent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', continentalUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow REC user to see child member state', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        tenantFixture({ parentId: 'tenant-igad' }),
      );

      const result = await service.findOne('tenant-ke', recUser());
      expect(result.data).toBeDefined();
    });

    it('should hide tenant from unrelated MS user (returns NotFoundException)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        tenantFixture({ id: 'tenant-ng', parentId: 'tenant-ecowas' }),
      );

      await expect(
        service.findOne('tenant-ng', msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update a tenant and publish Kafka event', async () => {
      const updated = tenantFixture({ name: 'Kenya (Updated)' });
      prisma.tenant.findUnique.mockResolvedValue(tenantFixture());
      prisma.tenant.update.mockResolvedValue(updated);

      const result = await service.update(
        'tenant-ke',
        { name: 'Kenya (Updated)' },
        continentalUser(),
      );

      expect(result.data.name).toBe('Kenya (Updated)');
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.tenant.updated.v1',
        'tenant-ke',
        expect.objectContaining({ name: 'Kenya (Updated)' }),
        expect.objectContaining({ sourceService: 'tenant-service' }),
      );
    });

    it('should throw NotFoundException when updating nonexistent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' }, continentalUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenantFixture());
      prisma.tenant.update.mockResolvedValue(tenantFixture({ isActive: false }));

      await service.update('tenant-ke', { isActive: false }, continentalUser());

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-ke' },
        data: { isActive: false },
      });
    });
  });

  // ── findChildren ──

  describe('findChildren', () => {
    it('should return children of a tenant', async () => {
      const igad = tenantFixture({
        id: 'tenant-igad',
        code: 'IGAD',
        level: TenantLevel.REC,
        parentId: 'tenant-au',
      });
      const children = [
        tenantFixture({ id: 'tenant-ke', parentId: 'tenant-igad' }),
        tenantFixture({ id: 'tenant-et', code: 'ET', parentId: 'tenant-igad' }),
      ];

      prisma.tenant.findUnique.mockResolvedValue(igad);
      prisma.tenant.findMany.mockResolvedValue(children);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.findChildren(
        'tenant-igad',
        continentalUser(),
        {},
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentId: 'tenant-igad' } }),
      );
    });

    it('should throw NotFoundException for nonexistent parent', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.findChildren('nonexistent', continentalUser(), {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow REC user to see own children', async () => {
      const igad = tenantFixture({
        id: 'tenant-igad',
        code: 'IGAD',
        level: TenantLevel.REC,
        parentId: 'tenant-au',
      });

      prisma.tenant.findUnique.mockResolvedValue(igad);
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      const result = await service.findChildren('tenant-igad', recUser(), {});
      expect(result.data).toHaveLength(0);
    });
  });
});
