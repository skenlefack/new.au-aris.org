import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WahisService } from '../wahis.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrisma() {
  return {
    exportRecord: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
}

function mockKafka() {
  return { send: vi.fn().mockResolvedValue([]) };
}

function continentalAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-au',
    email: 'admin@au-aris.org',
    role: UserRole.CONTINENTAL_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function nationalAdmin(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'cvo@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function exportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    tenant_id: 'tenant-ke',
    connector_type: 'WAHIS',
    country_code: 'KE',
    period_start: new Date('2024-01-01'),
    period_end: new Date('2024-06-30'),
    format: 'WOAH_JSON',
    status: 'PENDING',
    record_count: 0,
    package_url: null,
    package_size: null,
    error_message: null,
    exported_by: 'user-ke',
    exported_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Tests ──

describe('WahisService', () => {
  let service: WahisService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafka>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafka();
    service = new WahisService(prisma as never, kafka as never);
  });

  describe('createExport', () => {
    it('should create export record and generate WAHIS package', async () => {
      const pending = exportFixture();
      const completed = exportFixture({
        status: 'COMPLETED',
        record_count: 2,
        package_url: '/api/v1/interop/wahis/exports/exp-1/download',
        exported_at: new Date(),
      });

      prisma.exportRecord.create.mockResolvedValue(pending);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'wi-1', entity_type: 'submission', entity_id: 'sub-1', domain: 'health', created_at: new Date() },
        { id: 'wi-2', entity_type: 'submission', entity_id: 'sub-2', domain: 'health', created_at: new Date() },
      ]);
      prisma.exportRecord.update.mockResolvedValue(completed);

      const result = await service.createExport(
        { countryCode: 'KE', periodStart: '2024-01-01', periodEnd: '2024-06-30' },
        nationalAdmin(),
      );

      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.recordCount).toBe(2);
      expect(result.data.packageUrl).toContain('/download');
      expect(kafka.send).toHaveBeenCalledWith(
        'au.interop.wahis.exported.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should mark export as FAILED if package generation throws', async () => {
      const pending = exportFixture();
      const failed = exportFixture({ status: 'FAILED', error_message: 'DB error' });

      prisma.exportRecord.create.mockResolvedValue(pending);
      prisma.$queryRaw.mockRejectedValue(new Error('DB error'));
      prisma.exportRecord.update.mockResolvedValue(failed);

      const result = await service.createExport(
        { countryCode: 'KE', periodStart: '2024-01-01', periodEnd: '2024-06-30' },
        nationalAdmin(),
      );

      expect(result.data.status).toBe('FAILED');
      expect(result.data.errorMessage).toBe('DB error');
      expect(kafka.send).not.toHaveBeenCalled();
    });

    it('should not fail if Kafka publish errors', async () => {
      const pending = exportFixture();
      const completed = exportFixture({ status: 'COMPLETED', record_count: 0 });

      prisma.exportRecord.create.mockResolvedValue(pending);
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.exportRecord.update.mockResolvedValue(completed);
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.createExport(
        { countryCode: 'KE', periodStart: '2024-01-01', periodEnd: '2024-06-30' },
        nationalAdmin(),
      );

      expect(result.data.status).toBe('COMPLETED');
    });
  });

  describe('generateWahisPackage', () => {
    it('should return WahisPackage with events from workflow instances', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'wi-1', entity_type: 'submission', entity_id: 'sub-1', domain: 'health', created_at: new Date('2024-03-15') },
      ]);

      const pkg = await service.generateWahisPackage('exp-1', 'KE', new Date('2024-01-01'), new Date('2024-06-30'));

      expect(pkg.exportId).toBe('exp-1');
      expect(pkg.countryCode).toBe('KE');
      expect(pkg.totalEvents).toBe(1);
      expect(pkg.events[0].eventId).toBe('sub-1');
      expect(pkg.events[0].countryCode).toBe('KE');
      expect(pkg.events[0].confidenceLevel).toBe('CONFIRMED');
    });

    it('should return empty package when no WAHIS-ready instances', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const pkg = await service.generateWahisPackage('exp-2', 'ET', new Date('2024-01-01'), new Date('2024-06-30'));

      expect(pkg.totalEvents).toBe(0);
      expect(pkg.events).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('should return paginated WAHIS exports', async () => {
      prisma.exportRecord.findMany.mockResolvedValue([exportFixture()]);
      prisma.exportRecord.count.mockResolvedValue(1);

      const result = await service.findAll(continentalAdmin(), {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by tenant for MS users', async () => {
      prisma.exportRecord.findMany.mockResolvedValue([]);
      prisma.exportRecord.count.mockResolvedValue(0);

      await service.findAll(nationalAdmin(), {});

      expect(prisma.exportRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-ke',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return export by id', async () => {
      prisma.exportRecord.findUnique.mockResolvedValue(exportFixture());

      const result = await service.findOne('exp-1', continentalAdmin());

      expect(result.data.id).toBe('exp-1');
      expect(result.data.connectorType).toBe('WAHIS');
    });

    it('should throw NotFoundException for nonexistent record', async () => {
      prisma.exportRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', continentalAdmin()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny MS user access to another tenant export', async () => {
      prisma.exportRecord.findUnique.mockResolvedValue(
        exportFixture({ tenant_id: 'tenant-ng' }),
      );

      await expect(
        service.findOne('exp-1', nationalAdmin()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toEntity', () => {
    it('should map snake_case to camelCase', () => {
      const entity = service.toEntity(exportFixture());

      expect(entity.tenantId).toBe('tenant-ke');
      expect(entity.connectorType).toBe('WAHIS');
      expect(entity.countryCode).toBe('KE');
      expect(entity.exportedBy).toBe('user-ke');
    });
  });
});
