import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionService } from '../services/ingestion.service';
import { QueryEngineService } from '../services/query-engine.service';

/**
 * Integration-style tests that verify ingestion → query pipeline.
 * Uses mocks for Prisma/ES/Redis but tests the full flow.
 */

function createMockPrisma() {
  return {
    dataLakeEntry: {
      create: vi.fn().mockImplementation(async (args: any) => ({
        id: 'entry-uuid-1',
        ...args.data,
        ingested_at: new Date('2025-06-15T10:00:00Z'),
      })),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  } as any;
}

function createMockOpenSearch() {
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

describe('OLAP Integration', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let elastic: ReturnType<typeof createMockOpenSearch>;
  let redis: ReturnType<typeof createMockRedis>;
  let kafka: ReturnType<typeof createMockKafka>;
  let ingestionService: IngestionService;
  let queryEngine: QueryEngineService;

  beforeEach(() => {
    prisma = createMockPrisma();
    elastic = createMockOpenSearch();
    redis = createMockRedis();
    kafka = createMockKafka();
    ingestionService = new IngestionService(prisma, elastic, redis, kafka);
    queryEngine = new QueryEngineService(prisma);
  });

  it('should ingest event then query returns data', async () => {
    // 1. Ingest an event
    await ingestionService.ingest(
      'ms.health.outbreak.created.v1',
      { id: 'outbreak-1', tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789', countryCode: 'KE' },
      { tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789', sourceService: 'animal-health-service' },
    );

    // Verify ingestion happened
    expect(prisma.dataLakeEntry.create).toHaveBeenCalledTimes(1);
    const createData = prisma.dataLakeEntry.create.mock.calls[0][0].data;
    expect(createData.source).toBe('HEALTH');
    expect(createData.entity_type).toBe('health.outbreak');

    // 2. Query — mock the response as if the entry exists
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);

    const result = await queryEngine.query(
      {
        dimensions: [],
        measures: [{ field: '*', function: 'COUNT' }],
        source: 'HEALTH',
      },
      'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
      'MEMBER_STATE',
    );

    expect(result.data).toEqual([{ count: 1 }]);
  });

  it('should group time series data by month', async () => {
    // Mock time series result
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      { period: '2025-01-01T00:00:00Z', value: 10 },
      { period: '2025-02-01T00:00:00Z', value: 15 },
      { period: '2025-03-01T00:00:00Z', value: 8 },
    ]);

    const result = await queryEngine.timeseries(
      {
        metric: 'count',
        function: 'COUNT',
        granularity: 'month',
        dateRange: { from: '2025-01-01', to: '2025-12-31' },
      },
      'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
      'MEMBER_STATE',
    );

    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toHaveProperty('period');
    expect(result.data[0]).toHaveProperty('value');

    // Verify the SQL contains DATE_TRUNC with month
    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain("DATE_TRUNC('month'");
  });

  it('should filter geo bounding box query for matching entries', async () => {
    // Mock geo results
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'entry-1',
        source: 'HEALTH',
        entity_type: 'health.outbreak',
        geo_point: { lat: 1.3, lng: 36.8 },
        country_code: 'KE',
      },
    ]);

    const result = await queryEngine.geo(
      {
        bbox: { minLat: -5, minLng: 33, maxLat: 5, maxLng: 42 },
        source: 'HEALTH',
      },
      'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
      'MEMBER_STATE',
    );

    expect(result.data).toHaveLength(1);

    // Verify SQL contains geo bounding box
    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('"geo_point" IS NOT NULL');
    expect(sql).toContain("->>'lat')::float BETWEEN");
    expect(sql).toContain("->>'lng')::float BETWEEN");
  });
});
