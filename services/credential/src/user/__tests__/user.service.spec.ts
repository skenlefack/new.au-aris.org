import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../user.service';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrismaService() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
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

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    tenantId: 'tenant-ke',
    email: 'john@ke.aris.africa',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.NATIONAL_ADMIN,
    mfaEnabled: false,
    lastLoginAt: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(() => {
    prisma = mockPrismaService();
    service = new UserService(prisma as never);
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return all users for CONTINENTAL user (no tenant filter)', async () => {
      const users = [userFixture()];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll(continentalUser(), {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter to own + child tenants for REC user', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(recUser(), {});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant: {
              OR: [
                { id: 'tenant-igad' },
                { parentId: 'tenant-igad' },
              ],
            },
          },
        }),
      );
    });

    it('should filter to own tenant only for MEMBER_STATE user', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(msUser(), {});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-ke' },
        }),
      );
    });

    it('should respect pagination parameters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(50);

      const result = await service.findAll(continentalUser(), {
        page: 3,
        limit: 10,
        sort: 'email',
        order: 'desc',
      });

      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
          orderBy: { email: 'desc' },
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 });

      expect(result.meta.limit).toBe(100);
    });

    it('should default to page 1, limit 20, sort by createdAt asc', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  // ── findMe ──

  describe('findMe', () => {
    it('should return the calling user by userId', async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture({ id: 'user-ke' }));

      const result = await service.findMe(msUser());

      expect(result.data.id).toBe('user-ke');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-ke' },
        select: expect.objectContaining({ email: true, role: true }),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findMe(msUser())).rejects.toThrow(NotFoundException);
    });

    it('should not include passwordHash in response', async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());

      const result = await service.findMe(msUser());

      expect(result.data).not.toHaveProperty('passwordHash');
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update user fields and return updated user', async () => {
      const updated = userFixture({ firstName: 'Jane' });
      prisma.user.findUnique.mockResolvedValue(userFixture());
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.update(
        'user-001',
        { firstName: 'Jane' },
        continentalUser(),
      );

      expect(result.data.firstName).toBe('Jane');
    });

    it('should throw NotFoundException for nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { firstName: 'X' }, continentalUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow SUPER_ADMIN to change user role', async () => {
      const updated = userFixture({ role: UserRole.DATA_STEWARD });
      prisma.user.findUnique.mockResolvedValue(userFixture());
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.update(
        'user-001',
        { role: UserRole.DATA_STEWARD },
        continentalUser({ role: UserRole.SUPER_ADMIN }),
      );

      expect(result.data.role).toBe(UserRole.DATA_STEWARD);
    });

    it('should throw ForbiddenException if non-SUPER_ADMIN tries to change role', async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());

      await expect(
        service.update(
          'user-001',
          { role: UserRole.DATA_STEWARD },
          recUser({ role: UserRole.REC_ADMIN }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow non-SUPER_ADMIN to update non-role fields', async () => {
      const updated = userFixture({ email: 'new@ke.aris.africa' });
      prisma.user.findUnique.mockResolvedValue(userFixture());
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.update(
        'user-001',
        { email: 'new@ke.aris.africa' },
        recUser(),
      );

      expect(result.data.email).toBe('new@ke.aris.africa');
    });

    it('should not throw if dto.role matches existing role (no actual change)', async () => {
      const user = userFixture({ role: UserRole.NATIONAL_ADMIN });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      // Same role = not a role change, should be allowed by REC_ADMIN
      const result = await service.update(
        'user-001',
        { role: UserRole.NATIONAL_ADMIN },
        recUser(),
      );

      expect(result.data).toBeDefined();
    });

    it('should verify tenant access — CONTINENTAL can modify any tenant user', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ tenantId: 'tenant-ng' }),
      );
      prisma.user.update.mockResolvedValue(userFixture());

      // CONTINENTAL should be able to access any tenant
      await expect(
        service.update('user-001', { firstName: 'X' }, continentalUser()),
      ).resolves.toBeDefined();
    });

    it('should verify tenant access — MS user cannot modify user in another tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userFixture({ tenantId: 'tenant-ng' }),
      );

      await expect(
        service.update('user-001', { firstName: 'X' }, msUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should only include provided fields in update data', async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());
      prisma.user.update.mockResolvedValue(userFixture({ isActive: false }));

      await service.update('user-001', { isActive: false }, continentalUser());

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { isActive: false },
        select: expect.objectContaining({ email: true }),
      });
    });
  });
});
