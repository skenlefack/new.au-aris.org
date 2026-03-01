import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ContractService } from '../contract.service';
import { TenantLevel, UserRole, DataClassification } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

// ── Mock factories ──

function mockPrismaService() {
  return {
    dataContract: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
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
    email: 'admin@au-aris.org',
    role: UserRole.SUPER_ADMIN,
    tenantId: 'tenant-au',
    tenantLevel: TenantLevel.CONTINENTAL,
    ...overrides,
  };
}

function msUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-ke',
    email: 'admin@ke.au-aris.org',
    role: UserRole.NATIONAL_ADMIN,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
    ...overrides,
  };
}

function contractFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-1',
    tenant_id: 'tenant-ke',
    name: 'Animal Health Events (Kenya)',
    domain: 'health',
    data_owner: 'Kenya DVS',
    data_steward: 'DVS Data Unit',
    purpose: 'Disease event reporting',
    officiality_level: 'OFFICIAL',
    schema: { type: 'object' },
    frequency: 'REALTIME',
    timeliness_sla: 24,
    quality_sla: {
      correctionDeadline: 48,
      escalationDeadline: 72,
      minPassRate: 0.85,
    },
    classification: 'RESTRICTED',
    exchange_mechanism: 'KAFKA',
    version: 1,
    status: 'ACTIVE',
    valid_from: new Date('2024-01-01'),
    valid_to: null,
    approved_by: 'user-au',
    created_by: 'user-au',
    updated_by: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Tests ──

describe('ContractService', () => {
  let service: ContractService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let kafka: ReturnType<typeof mockKafkaProducer>;

  beforeEach(() => {
    prisma = mockPrismaService();
    kafka = mockKafkaProducer();
    service = new ContractService(prisma as never, kafka as never);
  });

  // ── create ──

  describe('create', () => {
    it('should create a contract and publish Kafka event', async () => {
      const dto = {
        name: 'Animal Health Events (Kenya)',
        domain: 'health',
        dataOwner: 'Kenya DVS',
        dataSteward: 'DVS Data Unit',
        purpose: 'Disease event reporting',
        officialityLevel: 'OFFICIAL' as const,
        schema: { type: 'object' },
        frequency: 'REALTIME' as const,
        timelinessSla: 24,
        qualitySla: { correctionDeadline: 48, escalationDeadline: 72, minPassRate: 0.85 },
        classification: DataClassification.RESTRICTED,
        exchangeMechanism: 'KAFKA' as const,
        validFrom: '2024-01-01',
        approvedBy: 'user-au',
      };

      prisma.dataContract.findFirst.mockResolvedValue(null);
      prisma.dataContract.create.mockResolvedValue(contractFixture());

      const result = await service.create(dto, continentalUser());

      expect(result.data.name).toBe('Animal Health Events (Kenya)');
      expect(result.data.version).toBe(1);
      expect(result.data.status).toBe('ACTIVE');
      expect(prisma.dataContract.create).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.contract.created.v1',
        'contract-1',
        expect.objectContaining({ name: 'Animal Health Events (Kenya)' }),
        expect.objectContaining({ sourceService: 'data-contract-service' }),
      );
    });

    it('should throw ConflictException if duplicate name+version exists', async () => {
      prisma.dataContract.findFirst.mockResolvedValue(contractFixture());

      await expect(
        service.create(
          {
            name: 'Animal Health Events (Kenya)',
            domain: 'health',
            dataOwner: 'Test',
            dataSteward: 'Test',
            purpose: 'Test',
            officialityLevel: 'OFFICIAL' as const,
            schema: {},
            frequency: 'REALTIME' as const,
            timelinessSla: 24,
            qualitySla: { correctionDeadline: 48, escalationDeadline: 72, minPassRate: 0.85 },
            classification: DataClassification.RESTRICTED,
            exchangeMechanism: 'API' as const,
            validFrom: '2024-01-01',
            approvedBy: 'user-au',
          },
          continentalUser(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should not fail request if Kafka publish errors', async () => {
      prisma.dataContract.findFirst.mockResolvedValue(null);
      prisma.dataContract.create.mockResolvedValue(contractFixture());
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      const result = await service.create(
        {
          name: 'Test Contract',
          domain: 'health',
          dataOwner: 'Test',
          dataSteward: 'Test',
          purpose: 'Test',
          officialityLevel: 'OFFICIAL' as const,
          schema: {},
          frequency: 'DAILY' as const,
          timelinessSla: 48,
          qualitySla: { correctionDeadline: 48, escalationDeadline: 72, minPassRate: 0.85 },
          classification: DataClassification.PUBLIC,
          exchangeMechanism: 'API' as const,
          validFrom: '2024-01-01',
          approvedBy: 'user-au',
        },
        continentalUser(),
      );

      expect(result.data).toBeDefined();
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return all contracts for CONTINENTAL user', async () => {
      prisma.dataContract.findMany.mockResolvedValue([contractFixture()]);
      prisma.dataContract.count.mockResolvedValue(1);

      const result = await service.findAll(continentalUser(), {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should filter by domain and status', async () => {
      prisma.dataContract.findMany.mockResolvedValue([]);
      prisma.dataContract.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), {
        domain: 'health',
        status: 'ACTIVE',
      });

      expect(prisma.dataContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domain: 'health',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should filter by owner (case-insensitive contains)', async () => {
      prisma.dataContract.findMany.mockResolvedValue([]);
      prisma.dataContract.count.mockResolvedValue(0);

      await service.findAll(continentalUser(), { owner: 'Kenya' });

      expect(prisma.dataContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            data_owner: { contains: 'Kenya', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      prisma.dataContract.findMany.mockResolvedValue([]);
      prisma.dataContract.count.mockResolvedValue(0);

      const result = await service.findAll(continentalUser(), { limit: 500 });

      expect(result.meta.limit).toBe(100);
    });

    it('should respect pagination parameters', async () => {
      prisma.dataContract.findMany.mockResolvedValue([]);
      prisma.dataContract.count.mockResolvedValue(50);

      const result = await service.findAll(continentalUser(), {
        page: 3,
        limit: 10,
        sort: 'name',
        order: 'desc',
      });

      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10 });
      expect(prisma.dataContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
          orderBy: { name: 'desc' },
        }),
      );
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return a contract by ID', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(contractFixture());

      const result = await service.findOne('contract-1', continentalUser());

      expect(result.data.name).toBe('Animal Health Events (Kenya)');
    });

    it('should throw NotFoundException for nonexistent contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', continentalUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny MS user access to another tenant contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(
        contractFixture({ tenant_id: 'tenant-ng' }),
      );

      await expect(
        service.findOne('contract-1', msUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow MS user to access own tenant contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(
        contractFixture({ tenant_id: 'tenant-ke' }),
      );

      const result = await service.findOne('contract-1', msUser());
      expect(result.data).toBeDefined();
    });
  });

  // ── update (versioned) ──

  describe('update', () => {
    it('should archive old version and create new version', async () => {
      const existing = contractFixture();
      prisma.dataContract.findUnique.mockResolvedValue(existing);
      prisma.dataContract.findFirst.mockResolvedValue(existing); // latest version

      const newContract = contractFixture({
        id: 'contract-2',
        version: 2,
        name: 'Animal Health Events (Kenya) — Updated',
      });

      // $transaction returns [archived, new]
      prisma.$transaction.mockResolvedValue([
        contractFixture({ status: 'ARCHIVED' }),
        newContract,
      ]);

      const result = await service.update(
        'contract-1',
        { name: 'Animal Health Events (Kenya) — Updated' },
        continentalUser(),
      );

      expect(result.data.version).toBe(2);
      expect(result.data.name).toBe('Animal Health Events (Kenya) — Updated');
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(kafka.send).toHaveBeenCalledWith(
        'sys.contract.updated.v1',
        'contract-2',
        expect.anything(),
        expect.objectContaining({ sourceService: 'data-contract-service' }),
      );
    });

    it('should throw NotFoundException when updating nonexistent contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' }, continentalUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating an archived contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(
        contractFixture({ status: 'ARCHIVED' }),
      );

      await expect(
        service.update('contract-1', { name: 'X' }, continentalUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment to version 3 when latest is version 2', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(contractFixture());
      prisma.dataContract.findFirst.mockResolvedValue(
        contractFixture({ version: 2 }),
      );

      const newContract = contractFixture({ id: 'contract-3', version: 3 });
      prisma.$transaction.mockResolvedValue([
        contractFixture({ status: 'ARCHIVED' }),
        newContract,
      ]);

      const result = await service.update(
        'contract-1',
        { timelinessSla: 12 },
        continentalUser(),
      );

      expect(result.data.version).toBe(3);
    });

    it('should deny MS user updating a different tenant contract', async () => {
      prisma.dataContract.findUnique.mockResolvedValue(
        contractFixture({ tenant_id: 'tenant-ng' }),
      );

      await expect(
        service.update('contract-1', { name: 'X' }, msUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── toEntity mapping ──

  describe('toEntity', () => {
    it('should map snake_case DB row to camelCase entity', () => {
      const row = contractFixture();
      const entity = service.toEntity(row);

      expect(entity.tenantId).toBe('tenant-ke');
      expect(entity.dataOwner).toBe('Kenya DVS');
      expect(entity.dataSteward).toBe('DVS Data Unit');
      expect(entity.officialityLevel).toBe('OFFICIAL');
      expect(entity.timelinessSla).toBe(24);
      expect(entity.qualitySla).toEqual({
        correctionDeadline: 48,
        escalationDeadline: 72,
        minPassRate: 0.85,
      });
      expect(entity.exchangeMechanism).toBe('KAFKA');
      expect(entity.validFrom).toEqual(new Date('2024-01-01'));
    });
  });
});
