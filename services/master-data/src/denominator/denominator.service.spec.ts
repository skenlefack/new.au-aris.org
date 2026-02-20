import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DenominatorService } from './denominator.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { KafkaProducerService } from '@aris/kafka-client';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole, TenantLevel } from '@aris/shared-types';

const mockUser: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'steward@ke.gov',
  role: UserRole.DATA_STEWARD,
  tenantId: '00000000-0000-0000-0000-000000000020',
  tenantLevel: TenantLevel.MEMBER_STATE,
};

const mockSpecies = {
  id: '00000000-0000-0000-0000-000000000200',
  code: 'BOS-TAU',
};

const mockDenominator = {
  id: '00000000-0000-0000-0000-000000000400',
  countryCode: 'KE',
  geoEntityId: null,
  speciesId: mockSpecies.id,
  year: 2023,
  source: 'FAOSTAT',
  population: BigInt(19400000),
  assumptions: 'FAOSTAT 2023 estimate',
  validatedAt: null,
  validatedBy: null,
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DenominatorService', () => {
  let service: DenominatorService;
  let prisma: {
    species: { findUnique: ReturnType<typeof vi.fn> };
    geoEntity: { findUnique: ReturnType<typeof vi.fn> };
    denominator: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let kafkaProducer: { send: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      species: { findUnique: vi.fn() },
      geoEntity: { findUnique: vi.fn() },
      denominator: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn() };
    kafkaProducer = { send: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        DenominatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: KafkaProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get(DenominatorService);
  });

  describe('create', () => {
    it('should create a denominator', async () => {
      prisma.species.findUnique.mockResolvedValue(mockSpecies);
      prisma.denominator.findFirst.mockResolvedValue(null);
      prisma.denominator.create.mockResolvedValue(mockDenominator);

      const result = await service.create(
        {
          countryCode: 'KE',
          speciesId: mockSpecies.id,
          year: 2023,
          source: 'FAOSTAT',
          population: 19400000,
          assumptions: 'FAOSTAT 2023 estimate',
        },
        mockUser,
      );

      expect(result.data).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'Denominator',
          dataClassification: 'PARTNER',
        }),
      );
    });

    it('should throw NotFoundException for missing species', async () => {
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            countryCode: 'KE',
            speciesId: 'missing',
            year: 2023,
            source: 'FAOSTAT',
            population: 100,
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate composite key', async () => {
      prisma.species.findUnique.mockResolvedValue(mockSpecies);
      prisma.denominator.findFirst.mockResolvedValue(mockDenominator);

      await expect(
        service.create(
          {
            countryCode: 'KE',
            speciesId: mockSpecies.id,
            year: 2023,
            source: 'FAOSTAT',
            population: 19400000,
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validate', () => {
    it('should validate and record audit trail', async () => {
      const validated = {
        ...mockDenominator,
        validatedAt: new Date(),
        validatedBy: mockUser.userId,
        version: 2,
      };
      prisma.denominator.findUnique.mockResolvedValue(mockDenominator);
      prisma.denominator.update.mockResolvedValue(validated);

      const result = await service.validate(mockDenominator.id, mockUser);

      expect(result.data).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VALIDATE' }),
      );
    });

    it('should throw NotFoundException for missing denominator', async () => {
      prisma.denominator.findUnique.mockResolvedValue(null);

      await expect(service.validate('missing', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should filter by country and year', async () => {
      prisma.denominator.findMany.mockResolvedValue([]);
      prisma.denominator.count.mockResolvedValue(0);

      await service.findAll({ countryCode: 'KE', year: 2023 });

      expect(prisma.denominator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ countryCode: 'KE', year: 2023 }),
        }),
      );
    });
  });
});
