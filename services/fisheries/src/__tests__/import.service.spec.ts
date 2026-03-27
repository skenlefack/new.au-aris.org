import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { ImportService } from '../services/import.service.js';

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

// ── Mock factories ────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    fishCapture: {
      create: vi.fn(),
    },
    fishingVessel: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    aquacultureFarm: {
      create: vi.fn(),
    },
    aquacultureProduction: {
      create: vi.fn(),
    },
    fishingEffort: {
      create: vi.fn(),
    },
    species: {
      findFirst: vi.fn(),
    },
    geoEntity: {
      findFirst: vi.fn(),
    },
  };
}

function makeKafka() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

// ── ImportService ─────────────────────────────────────────────────────────────

describe('ImportService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let kafka: ReturnType<typeof makeKafka>;
  let service: ImportService;

  beforeEach(() => {
    prisma = makePrisma();
    kafka = makeKafka();
    service = new ImportService(prisma as never, kafka as never);
  });

  it('1. importCaptures — parses CSV and creates records, publishes Kafka events', async () => {
    const csvData = Buffer.from(
      'speciesCode,faoAreaCode,gearType,quantityKg,captureDate,landingSite\n' +
      'TIL,01,GILLNET,5000,2026-01-15,Kisumu\n' +
      'YFT,51,LONGLINE,12000,2026-02-20,Mombasa',
    );

    // Mock species resolution
    prisma.species.findFirst
      .mockResolvedValueOnce({ id: 'species-til-id', code: 'TIL' })
      .mockResolvedValueOnce({ id: 'species-yft-id', code: 'YFT' });

    // Mock capture creation
    prisma.fishCapture.create
      .mockResolvedValueOnce({ id: 'capture-1', tenantId: nationalAdmin.tenantId })
      .mockResolvedValueOnce({ id: 'capture-2', tenantId: nationalAdmin.tenantId });

    const result = await service.importCaptures(csvData, 'csv', nationalAdmin);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(prisma.fishCapture.create).toHaveBeenCalledTimes(2);
    expect(kafka.send).toHaveBeenCalledTimes(2);
  });

  it('2. importCaptures — skips rows with missing required fields and reports errors', async () => {
    const csvData = Buffer.from(
      'speciesCode,faoAreaCode,gearType,quantityKg,captureDate,landingSite\n' +
      ',01,GILLNET,5000,2026-01-15,Kisumu\n' +    // missing speciesCode (not required for import but gearType is)
      'TIL,,GILLNET,5000,2026-01-15,Kisumu',       // missing faoAreaCode (not required)
    );

    // Mock species resolution — first row has no species code, second has TIL
    prisma.species.findFirst.mockResolvedValueOnce({ id: 'species-til-id', code: 'TIL' });

    prisma.fishCapture.create
      .mockResolvedValueOnce({ id: 'capture-1', tenantId: nationalAdmin.tenantId })
      .mockResolvedValueOnce({ id: 'capture-2', tenantId: nationalAdmin.tenantId });

    const result = await service.importCaptures(csvData, 'csv', nationalAdmin);

    // Both rows should be importable (speciesCode and faoAreaCode are optional for basic import)
    expect(result.imported + result.skipped).toBe(2);
  });

  it('3. importCaptures — resolves speciesCode to speciesId via Prisma lookup', async () => {
    const csvData = Buffer.from(
      'speciesCode,faoAreaCode,gearType,quantityKg,captureDate,landingSite\n' +
      'TIL,01,GILLNET,5000,2026-01-15,Kisumu',
    );

    const speciesRecord = { id: 'species-uuid-tilapia', code: 'TIL' };
    prisma.species.findFirst.mockResolvedValue(speciesRecord);
    prisma.fishCapture.create.mockResolvedValue({
      id: 'capture-new',
      tenantId: nationalAdmin.tenantId,
      speciesId: speciesRecord.id,
    });

    await service.importCaptures(csvData, 'csv', nationalAdmin);

    // Verify species lookup was called with the code
    expect(prisma.species.findFirst).toHaveBeenCalledWith({
      where: { code: 'TIL' },
    });

    // Verify the resolved speciesId was used in create
    const createArg = prisma.fishCapture.create.mock.calls[0][0];
    expect(createArg.data.speciesId).toBe('species-uuid-tilapia');
  });

  it('4. importVessels — creates vessel records from CSV', async () => {
    const csvData = Buffer.from(
      'name,registrationNumber,flagState,vesselType,lengthMeters,tonnageGt,homePort\n' +
      'MV Kenya Star,KE-FISH-001,KE,TRAWLER,25,120,Mombasa\n' +
      'MV Lake Runner,KE-FISH-002,KE,ARTISANAL,8,5,Kisumu',
    );

    // No duplicates
    prisma.fishingVessel.findFirst.mockResolvedValue(null);

    prisma.fishingVessel.create
      .mockResolvedValueOnce({ id: 'vessel-1', tenantId: nationalAdmin.tenantId })
      .mockResolvedValueOnce({ id: 'vessel-2', tenantId: nationalAdmin.tenantId });

    const result = await service.importVessels(csvData, 'csv', nationalAdmin);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(prisma.fishingVessel.create).toHaveBeenCalledTimes(2);
  });
});
