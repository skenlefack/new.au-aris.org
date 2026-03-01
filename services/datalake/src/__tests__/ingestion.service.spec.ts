import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionService } from '../services/ingestion.service';

function createMockPrisma() {
  return {
    dataLakeEntry: {
      create: vi.fn().mockResolvedValue({
        id: 'entry-uuid-1',
        ingested_at: new Date('2025-06-15T10:00:00Z'),
      }),
    },
  } as any;
}

function createMockElastic() {
  return {
    index: vi.fn().mockResolvedValue({}),
  } as any;
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
  } as any;
}

function createMockKafka() {
  return {
    send: vi.fn().mockResolvedValue([]),
  } as any;
}

describe('IngestionService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let elastic: ReturnType<typeof createMockElastic>;
  let redis: ReturnType<typeof createMockRedis>;
  let kafka: ReturnType<typeof createMockKafka>;
  let service: IngestionService;

  beforeEach(() => {
    prisma = createMockPrisma();
    elastic = createMockElastic();
    redis = createMockRedis();
    kafka = createMockKafka();
    service = new IngestionService(prisma, elastic, redis, kafka);
  });

  it('should parse topic into source, entityType, action', () => {
    const parsed = service.parseTopic('ms.health.outbreak.created.v1');
    expect(parsed).toEqual({
      scope: 'ms',
      domain: 'health',
      entityType: 'outbreak',
      action: 'created',
      version: 'v1',
    });
  });

  it('should extract geo point from payload', () => {
    // Direct lat/lng
    expect(service.extractGeoPoint({ latitude: 1.23, longitude: 36.82 })).toEqual({
      lat: 1.23,
      lng: 36.82,
    });

    // Nested location
    expect(service.extractGeoPoint({ location: { lat: -1.3, lng: 36.8 } })).toEqual({
      lat: -1.3,
      lng: 36.8,
    });

    // geoPoint field
    expect(service.extractGeoPoint({ geoPoint: { lat: 5.0, lng: 10.0 } })).toEqual({
      lat: 5.0,
      lng: 10.0,
    });

    // No geo data
    expect(service.extractGeoPoint({ name: 'test' })).toBeNull();
  });

  it('should enrich with year/month/week', async () => {
    await service.ingest(
      'ms.health.outbreak.created.v1',
      { id: 'entity-1', tenantId: 'tenant-1' },
      { tenantId: 'tenant-1' },
    );

    const createCall = prisma.dataLakeEntry.create.mock.calls[0][0];
    expect(createCall.data.year).toBeGreaterThanOrEqual(2025);
    expect(createCall.data.month).toBeGreaterThanOrEqual(1);
    expect(createCall.data.month).toBeLessThanOrEqual(12);
    expect(createCall.data.week).toBeGreaterThanOrEqual(1);
    expect(createCall.data.week).toBeLessThanOrEqual(53);
  });

  it('should insert into DataLakeEntry and index in ES', async () => {
    await service.ingest(
      'ms.livestock.census.created.v1',
      { id: 'census-1', tenantId: 'tenant-2', countryCode: 'KE' },
      { tenantId: 'tenant-2', sourceService: 'livestock-prod-service' },
    );

    // Prisma insert
    expect(prisma.dataLakeEntry.create).toHaveBeenCalledTimes(1);
    const createData = prisma.dataLakeEntry.create.mock.calls[0][0].data;
    expect(createData.source).toBe('LIVESTOCK');
    expect(createData.entity_type).toBe('livestock.census');
    expect(createData.entity_id).toBe('census-1');
    expect(createData.action).toBe('created');
    expect(createData.tenant_id).toBe('tenant-2');
    expect(createData.country_code).toBe('KE');

    // ES index
    expect(elastic.index).toHaveBeenCalledTimes(1);
    const esCall = elastic.index.mock.calls[0][0];
    expect(esCall.index).toBe('aris-datalake-livestock');
    expect(esCall.body.source).toBe('LIVESTOCK');
  });
});
