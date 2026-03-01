import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FaostatService } from '../faostat.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    syncRecord: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function mockKafka() {
  return { send: vi.fn().mockResolvedValue([]) };
}

function user(): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@au-aris.org',
    role: UserRole.CONTINENTAL_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
  };
}

function syncFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sync-1',
    tenant_id: 'tenant-au',
    connector_type: 'FAOSTAT',
    country_code: 'KE',
    year: 2023,
    status: 'PENDING',
    records_imported: 0,
    records_updated: 0,
    discrepancies: 0,
    discrepancy_details: null,
    source_url: null,
    synced_by: 'user-au',
    synced_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('FaostatService', () => {
  let service: FaostatService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafka>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafka();
    service = new FaostatService(prisma as never, kafka as never);
  });

  describe('createSync', () => {
    it('should create sync record and reconcile denominators', async () => {
      const pending = syncFixture({ status: 'IN_PROGRESS' });
      const completed = syncFixture({
        status: 'COMPLETED',
        records_imported: 3,
        records_updated: 0,
        discrepancies: 0,
        synced_at: new Date(),
      });

      prisma.syncRecord.create.mockResolvedValue(pending);
      prisma.syncRecord.update.mockResolvedValue(completed);

      const result = await service.createSync(
        {
          countryCode: 'KE',
          year: 2023,
          records: [
            { countryCode: 'KE', speciesCode: 'BOV', year: 2023, population: 20_000_000 },
            { countryCode: 'KE', speciesCode: 'OVI', year: 2023, population: 17_000_000 },
            { countryCode: 'KE', speciesCode: 'CAP', year: 2023, population: 15_000_000 },
          ],
        },
        user(),
      );

      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.recordsImported).toBe(3);
      expect(kafka.send).toHaveBeenCalledWith(
        'au.interop.faostat.synced.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should mark sync as FAILED on error', async () => {
      const pending = syncFixture({ status: 'IN_PROGRESS' });
      const failed = syncFixture({ status: 'FAILED', error_message: 'Parse error' });

      prisma.syncRecord.create.mockResolvedValue(pending);
      prisma.syncRecord.update.mockResolvedValue(failed);

      // Force reconcile to throw
      vi.spyOn(service, 'reconcileDenominators').mockRejectedValue(new Error('Parse error'));

      const result = await service.createSync(
        { countryCode: 'KE', year: 2023, records: [] },
        user(),
      );

      expect(result.data.status).toBe('FAILED');
    });
  });

  describe('reconcileDenominators', () => {
    it('should count new records as imported when no existing data', async () => {
      // findExistingDenominator returns null by default (mock)
      const result = await service.reconcileDenominators([
        { countryCode: 'KE', speciesCode: 'BOV', year: 2023, population: 20_000_000 },
        { countryCode: 'KE', speciesCode: 'OVI', year: 2023, population: 17_000_000 },
      ]);

      expect(result.imported).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('should detect discrepancies when existing data differs > 10%', async () => {
      vi.spyOn(service, 'findExistingDenominator').mockResolvedValue({ population: 15_000_000 });

      const result = await service.reconcileDenominators([
        { countryCode: 'KE', speciesCode: 'BOV', year: 2023, population: 20_000_000 }, // 33% diff
      ]);

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0].existingValue).toBe(15_000_000);
      expect(result.discrepancies[0].faostatValue).toBe(20_000_000);
      expect(result.discrepancies[0].percentDiff).toBeCloseTo(33.33, 1);
    });

    it('should NOT flag discrepancy when difference <= 10%', async () => {
      vi.spyOn(service, 'findExistingDenominator').mockResolvedValue({ population: 19_000_000 });

      const result = await service.reconcileDenominators([
        { countryCode: 'KE', speciesCode: 'BOV', year: 2023, population: 20_000_000 }, // 5.3% diff
      ]);

      expect(result.discrepancies).toHaveLength(0);
    });

    it('should handle zero existing population', async () => {
      vi.spyOn(service, 'findExistingDenominator').mockResolvedValue({ population: 0 });

      const result = await service.reconcileDenominators([
        { countryCode: 'KE', speciesCode: 'BOV', year: 2023, population: 1000 },
      ]);

      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0].percentDiff).toBe(100);
    });
  });

  describe('findAll', () => {
    it('should return paginated FAOSTAT syncs', async () => {
      prisma.syncRecord.findMany.mockResolvedValue([syncFixture()]);
      prisma.syncRecord.count.mockResolvedValue(1);

      const result = await service.findAll(user(), {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].connectorType).toBe('FAOSTAT');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });
  });

  describe('toEntity', () => {
    it('should map snake_case to camelCase', () => {
      const entity = service.toEntity(syncFixture({
        records_imported: 5,
        records_updated: 2,
        discrepancies: 1,
      }));

      expect(entity.tenantId).toBe('tenant-au');
      expect(entity.countryCode).toBe('KE');
      expect(entity.year).toBe(2023);
      expect(entity.recordsImported).toBe(5);
      expect(entity.recordsUpdated).toBe(2);
      expect(entity.discrepancies).toBe(1);
      expect(entity.syncedBy).toBe('user-au');
    });
  });
});
