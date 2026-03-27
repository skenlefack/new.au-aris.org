import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { ExportService } from '../services/export.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const nationalAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000101',
  email: 'admin@ke.au-aris.org',
  firstName: 'Kenya',
  lastName: 'Admin',
  role: UserRole.NATIONAL_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000101',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const superAdmin: AuthenticatedUser = {
  userId: '10000000-0000-4000-a000-000000000001',
  email: 'admin@au-aris.org',
  firstName: 'Super',
  lastName: 'Admin',
  role: UserRole.SUPER_ADMIN,
  tenantId: '00000000-0000-4000-a000-000000000001',
  tenantLevel: TenantLevel.CONTINENTAL,
};

// ── Mock factories ────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    fishCapture: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fishingVessel: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aquacultureFarm: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aquacultureProduction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fishingEffort: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

// ── ExportService ─────────────────────────────────────────────────────────────

describe('ExportService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: ExportService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ExportService(prisma as never);
  });

  it('1. exportCaptures — returns a valid Buffer (xlsx format)', async () => {
    const captures = [
      {
        id: 'c-1',
        tenantId: nationalAdmin.tenantId,
        speciesId: 'sp-1',
        faoAreaCode: '51',
        gearType: 'TRAWL',
        quantityKg: 1500,
        landingSite: 'Mombasa',
        captureDate: new Date('2026-01-15'),
        fishingEnvironment: 'MARINE',
        productionType: 'INDUSTRIAL',
        status: 'VALIDATED',
        createdAt: new Date(),
      },
    ];

    prisma.fishCapture.findMany.mockResolvedValue(captures);

    const result = await service.exportCaptures({}, 'xlsx', nationalAdmin);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('2. exportCaptures — applies tenant scoping for MEMBER_STATE users', async () => {
    prisma.fishCapture.findMany.mockResolvedValue([]);

    await service.exportCaptures({}, 'xlsx', nationalAdmin);

    const findManyArg = prisma.fishCapture.findMany.mock.calls[0][0];
    expect(findManyArg.where.tenantId).toBe(nationalAdmin.tenantId);
  });

  it('3. exportCaptures — filters by year when year filter provided', async () => {
    prisma.fishCapture.findMany.mockResolvedValue([]);

    await service.exportCaptures({ year: 2025 }, 'xlsx', superAdmin);

    const findManyArg = prisma.fishCapture.findMany.mock.calls[0][0];
    expect(findManyArg.where.captureDate).toBeDefined();
    expect(findManyArg.where.captureDate.gte).toEqual(new Date('2025-01-01'));
    expect(findManyArg.where.captureDate.lt).toEqual(new Date('2026-01-01'));
  });

  it('4. exportFishStatJ — queries captures and aquaculture production', async () => {
    prisma.fishCapture.findMany.mockResolvedValue([]);
    prisma.aquacultureProduction.findMany.mockResolvedValue([]);

    const result = await service.exportFishStatJ(2025, superAdmin);

    expect(result).toBeInstanceOf(Buffer);
    expect(prisma.fishCapture.findMany).toHaveBeenCalled();
    expect(prisma.aquacultureProduction.findMany).toHaveBeenCalled();
  });
});
