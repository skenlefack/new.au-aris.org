import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from './audit.service';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@au-ibar.org',
  role: UserRole.CONTINENTAL_ADMIN,
  tenantId: '00000000-0000-0000-0000-000000000010',
  tenantLevel: TenantLevel.CONTINENTAL,
};

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    masterDataAudit: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      masterDataAudit: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new AuditService(prisma as any);
  });

  it('should log an audit entry', async () => {
    prisma.masterDataAudit.create.mockResolvedValue({ id: 'audit-1' });

    await service.log({
      entityType: 'GeoEntity',
      entityId: 'entity-1',
      action: 'CREATE',
      user: mockUser,
      newVersion: { code: 'KE' },
      dataClassification: 'PUBLIC',
    });

    expect(prisma.masterDataAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'GeoEntity',
        entityId: 'entity-1',
        action: 'CREATE',
        actorUserId: mockUser.userId,
        actorRole: mockUser.role,
        actorTenantId: mockUser.tenantId,
        dataClassification: 'PUBLIC',
      }),
    });
  });

  it('should not throw if audit logging fails', async () => {
    prisma.masterDataAudit.create.mockRejectedValue(new Error('DB error'));

    // Should not throw
    await service.log({
      entityType: 'Species',
      entityId: 'species-1',
      action: 'UPDATE',
      user: mockUser,
    });
  });

  it('should find audit entries by entity', async () => {
    const mockEntries = [
      { id: '1', entityType: 'GeoEntity', entityId: 'entity-1', action: 'CREATE' },
      { id: '2', entityType: 'GeoEntity', entityId: 'entity-1', action: 'UPDATE' },
    ];
    prisma.masterDataAudit.findMany.mockResolvedValue(mockEntries);

    const entries = await service.findByEntity('GeoEntity', 'entity-1');

    expect(entries).toHaveLength(2);
    expect(prisma.masterDataAudit.findMany).toHaveBeenCalledWith({
      where: { entityType: 'GeoEntity', entityId: 'entity-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
