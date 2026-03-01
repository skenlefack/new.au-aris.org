import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmpresService } from '../empres.service';
import { TenantLevel, UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

function mockPrisma() {
  return {
    feedRecord: {
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
    userId: 'user-ke',
    email: 'steward@ke.au-aris.org',
    role: UserRole.DATA_STEWARD,
    tenantId: 'tenant-ke',
    tenantLevel: TenantLevel.MEMBER_STATE,
  };
}

function feedFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feed-1',
    tenant_id: 'tenant-ke',
    connector_type: 'EMPRES',
    health_event_id: 'he-1',
    disease_id: null,
    country_code: 'KE',
    confidence_level: 'CONFIRMED',
    status: 'PENDING',
    payload: {},
    response_code: null,
    response_body: null,
    error_message: null,
    fed_by: 'user-ke',
    fed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('EmpresService', () => {
  let service: EmpresService;
  let prisma: ReturnType<typeof mockPrisma>;
  let kafka: ReturnType<typeof mockKafka>;

  beforeEach(() => {
    prisma = mockPrisma();
    kafka = mockKafka();
    service = new EmpresService(prisma as never, kafka as never);
  });

  describe('createFeed', () => {
    it('should create feed record and push signal to EMPRES', async () => {
      const pending = feedFixture();
      const completed = feedFixture({
        status: 'COMPLETED',
        response_code: 200,
        response_body: '{"accepted":true}',
        fed_at: new Date(),
      });

      prisma.feedRecord.create.mockResolvedValue(pending);
      prisma.feedRecord.update.mockResolvedValue(completed);

      const result = await service.createFeed(
        {
          healthEventId: 'he-1',
          diseaseCode: 'FMD-001',
          countryCode: 'KE',
          confidenceLevel: 'CONFIRMED',
          context: 'FMD outbreak in Nairobi County',
          species: ['cattle', 'sheep'],
          cases: 150,
          deaths: 12,
        },
        user(),
      );

      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.responseCode).toBe(200);
      expect(kafka.send).toHaveBeenCalledWith(
        'au.interop.empres.fed.v1',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should mark feed as FAILED if EMPRES endpoint throws', async () => {
      const pending = feedFixture();
      const failed = feedFixture({ status: 'FAILED', error_message: 'Connection refused' });

      prisma.feedRecord.create.mockResolvedValue(pending);
      prisma.feedRecord.update.mockResolvedValue(failed);

      // Override sendToEmpres to simulate failure
      vi.spyOn(service, 'sendToEmpres').mockRejectedValue(new Error('Connection refused'));

      const result = await service.createFeed(
        {
          healthEventId: 'he-1',
          diseaseCode: 'FMD-001',
          countryCode: 'KE',
          confidenceLevel: 'CONFIRMED',
          context: 'FMD outbreak',
        },
        user(),
      );

      expect(result.data.status).toBe('FAILED');
      expect(result.data.errorMessage).toBe('Connection refused');
    });
  });

  describe('sendToEmpres', () => {
    it('should return 200 status (mock adapter)', async () => {
      const response = await service.sendToEmpres({
        signalId: 'sig-1',
        eventId: 'he-1',
        diseaseCode: 'FMD-001',
        countryCode: 'KE',
        reportDate: new Date().toISOString(),
        confidence: 'CONFIRMED',
        context: 'test',
        coordinates: null,
        species: [],
        cases: 0,
        deaths: 0,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).accepted).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return paginated EMPRES feeds', async () => {
      prisma.feedRecord.findMany.mockResolvedValue([feedFixture()]);
      prisma.feedRecord.count.mockResolvedValue(1);

      const result = await service.findAll(user(), {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].connectorType).toBe('EMPRES');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });
  });

  describe('toEntity', () => {
    it('should map snake_case to camelCase', () => {
      const entity = service.toEntity(feedFixture());

      expect(entity.tenantId).toBe('tenant-ke');
      expect(entity.healthEventId).toBe('he-1');
      expect(entity.confidenceLevel).toBe('CONFIRMED');
      expect(entity.fedBy).toBe('user-ke');
    });
  });
});
