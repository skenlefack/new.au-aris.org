import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskLayerService } from '../services/risk-layer.service';

// ── Mock factories ──

function createMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  };
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue([]),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Fixtures ──

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';

const SAMPLE_POLYGON = {
  type: 'Polygon',
  coordinates: [[[36, 0], [37, 0], [37, 1], [36, 1], [36, 0]]],
};

const SAMPLE_GEOJSON_STR = JSON.stringify(SAMPLE_POLYGON);

const SAMPLE_DB_ROW = {
  id: 'risk-layer-1',
  tenant_id: TENANT_ID,
  name: 'FMD Risk Zone',
  description: 'Foot and Mouth Disease risk area',
  layer_type: 'DISEASE_RISK',
  severity: 'HIGH',
  geojson: SAMPLE_GEOJSON_STR,
  properties: { disease: 'FMD' },
  data_classification: 'PUBLIC',
  valid_from: new Date('2024-01-01'),
  valid_until: new Date('2024-12-31'),
  source: 'WOAH',
  is_active: true,
  created_by: USER_ID,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
};

const SAMPLE_INPUT = {
  name: 'FMD Risk Zone',
  description: 'Foot and Mouth Disease risk area',
  layerType: 'DISEASE_RISK' as const,
  severity: 'HIGH' as const,
  geometry: SAMPLE_POLYGON as any,
  properties: { disease: 'FMD' },
  dataClassification: 'PUBLIC' as const,
  validFrom: '2024-01-01T00:00:00.000Z',
  validUntil: '2024-12-31T00:00:00.000Z',
  source: 'WOAH',
};

// ── Tests ──

describe('RiskLayerService', () => {
  let service: RiskLayerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let kafka: ReturnType<typeof createMockKafka>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    kafka = createMockKafka();
    service = new RiskLayerService(prisma as any, redis as any, kafka as any);
  });

  // ── create ──

  describe('create', () => {
    it('inserts a new risk layer and returns the response', async () => {
      // First call: $executeRaw (insert), second: $queryRaw (findById)
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);

      const result = await service.create(SAMPLE_INPUT, TENANT_ID, USER_ID);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.name).toBe('FMD Risk Zone');
      expect(result.layerType).toBe('DISEASE_RISK');
      expect(result.severity).toBe('HIGH');
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.geometry).toEqual(SAMPLE_POLYGON);
    });

    it('publishes a Kafka event after creation', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);

      await service.create(SAMPLE_INPUT, TENANT_ID, USER_ID);

      expect(kafka.send).toHaveBeenCalledWith(
        'ms.geo.risk-layer.created.v1',
        expect.any(String),
        expect.objectContaining({ name: 'FMD Risk Zone' }),
        expect.objectContaining({
          sourceService: 'geo-services',
          tenantId: TENANT_ID,
        }),
      );
    });

    it('invalidates bbox cache after creation', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);
      redis.keys.mockResolvedValue(['aris:geo:risk-layers:bbox:key1', 'aris:geo:risk-layers:bbox:key2']);

      await service.create(SAMPLE_INPUT, TENANT_ID, USER_ID);

      expect(redis.keys).toHaveBeenCalledWith('aris:geo:risk-layers:bbox:*');
      expect(redis.del).toHaveBeenCalledWith(
        'aris:geo:risk-layers:bbox:key1',
        'aris:geo:risk-layers:bbox:key2',
      );
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('returns cached risk layer on cache hit', async () => {
      const cachedLayer = {
        id: 'risk-layer-1',
        tenantId: TENANT_ID,
        name: 'Cached Layer',
        layerType: 'CLIMATE',
        severity: 'LOW',
      };
      redis.get.mockResolvedValue(JSON.stringify(cachedLayer));

      const result = await service.findById('risk-layer-1', TENANT_ID);

      expect(result).toEqual(cachedLayer);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('queries Prisma on cache miss and caches result', async () => {
      redis.get.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);

      const result = await service.findById('risk-layer-1', TENANT_ID);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.id).toBe('risk-layer-1');
      expect(result.name).toBe('FMD Risk Zone');
      expect(redis.set).toHaveBeenCalledWith(
        'aris:geo:risk-layer:risk-layer-1',
        expect.any(String),
        'EX',
        300,
      );
    });

    it('throws 404 when not found', async () => {
      redis.get.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.findById('nonexistent', TENANT_ID))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── findAll ──

  describe('findAll', () => {
    it('returns paginated risk layers with default page/limit', async () => {
      // Count query
      prisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([SAMPLE_DB_ROW, { ...SAMPLE_DB_ROW, id: 'risk-layer-2', name: 'Climate Zone' }]);

      const result = await service.findAll(TENANT_ID);

      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
      expect(result.data).toHaveLength(2);
    });

    it('applies layerType and severity filters', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([SAMPLE_DB_ROW]);

      const result = await service.findAll(TENANT_ID, {
        layerType: 'DISEASE_RISK',
        severity: 'HIGH',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.limit).toBe(10);
    });
  });

  // ── findByBbox ──

  describe('findByBbox', () => {
    it('returns risk layers within bounding box', async () => {
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);

      const result = await service.findByBbox(
        { west: 35, south: -2, east: 38, north: 2 },
        TENANT_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('FMD Risk Zone');
    });

    it('returns cached bbox results on cache hit', async () => {
      const cachedResult = [{ id: 'cached-1', name: 'Cached Layer' }];
      redis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.findByBbox(
        { west: 35, south: -2, east: 38, north: 2 },
        TENANT_ID,
      );

      expect(result).toEqual(cachedResult);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns empty array when no layers in bbox', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.findByBbox(
        { west: 0, south: 0, east: 1, north: 1 },
        TENANT_ID,
      );

      expect(result).toEqual([]);
    });
  });

  // ── update ──

  describe('update', () => {
    it('updates risk layer fields and returns updated response', async () => {
      // findById (before update): returns existing
      prisma.$queryRaw
        .mockResolvedValueOnce([SAMPLE_DB_ROW])
        // $executeRaw: update is next in sequence
        // findById (after update): returns updated
        .mockResolvedValueOnce([{ ...SAMPLE_DB_ROW, name: 'Updated Zone', severity: 'CRITICAL' }]);

      prisma.$executeRaw.mockResolvedValue(1);

      const result = await service.update(
        'risk-layer-1',
        { name: 'Updated Zone', severity: 'CRITICAL' },
        TENANT_ID,
        USER_ID,
      );

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.name).toBe('Updated Zone');
      expect(result.severity).toBe('CRITICAL');
    });

    it('throws 404 when updating non-existent layer', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.update('nonexistent', { name: 'Test' }, TENANT_ID),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('publishes update event to Kafka', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([SAMPLE_DB_ROW])
        .mockResolvedValueOnce([SAMPLE_DB_ROW]);
      prisma.$executeRaw.mockResolvedValue(1);

      await service.update('risk-layer-1', { name: 'Updated' }, TENANT_ID, USER_ID);

      expect(kafka.send).toHaveBeenCalledWith(
        'ms.geo.risk-layer.updated.v1',
        'risk-layer-1',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'geo-services' }),
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('soft deletes by setting is_active to false', async () => {
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);
      prisma.$executeRaw.mockResolvedValue(1);

      await service.delete('risk-layer-1', TENANT_ID, USER_ID);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('publishes delete event to Kafka', async () => {
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);
      prisma.$executeRaw.mockResolvedValue(1);

      await service.delete('risk-layer-1', TENANT_ID, USER_ID);

      expect(kafka.send).toHaveBeenCalledWith(
        'ms.geo.risk-layer.deleted.v1',
        'risk-layer-1',
        expect.any(Object),
        expect.objectContaining({ sourceService: 'geo-services' }),
      );
    });

    it('throws 404 when deleting non-existent layer', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.delete('nonexistent', TENANT_ID),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('invalidates cache after deletion', async () => {
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);
      prisma.$executeRaw.mockResolvedValue(1);
      redis.keys.mockResolvedValue(['aris:geo:risk-layers:bbox:x']);

      await service.delete('risk-layer-1', TENANT_ID);

      expect(redis.del).toHaveBeenCalledWith('aris:geo:risk-layer:risk-layer-1');
      expect(redis.del).toHaveBeenCalledWith('aris:geo:risk-layers:bbox:x');
    });
  });

  // ── Kafka failure is non-fatal ──

  describe('kafka resilience', () => {
    it('does not throw when kafka publish fails', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);
      kafka.send.mockRejectedValue(new Error('Kafka down'));

      // Should NOT throw despite kafka failure
      const result = await service.create(SAMPLE_INPUT, TENANT_ID, USER_ID);
      expect(result.name).toBe('FMD Risk Zone');
    });

    it('works when kafka producer is null', async () => {
      const serviceNoKafka = new RiskLayerService(prisma as any, redis as any, null);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([SAMPLE_DB_ROW]);

      const result = await serviceNoKafka.create(SAMPLE_INPUT, TENANT_ID, USER_ID);
      expect(result.name).toBe('FMD Risk Zone');
    });
  });
});
