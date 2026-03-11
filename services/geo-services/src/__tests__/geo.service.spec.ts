import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeoService } from '../services/geo.service';
import {
  buildFeature,
  buildFeatureCollection,
  classifySeverity,
  CACHE_TTL_LAYERS,
  CACHE_TTL_WITHIN,
  CACHE_TTL_NEAREST,
  CACHE_TTL_CONTAINS,
  CACHE_TTL_BOUNDARY,
  CACHE_TTL_RISK_MAP,
} from '../geo/entities/geo.entity';

// ── Mock factories ──

function createMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    mapLayer: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

// ── Shared fixtures ──

const SAMPLE_GEOJSON =
  '{"type":"MultiPolygon","coordinates":[[[[36,0],[37,0],[37,1],[36,1],[36,0]]]]}';

const SAMPLE_SPATIAL_ROW = {
  id: 'uuid-1',
  code: 'KE',
  name: 'Kenya',
  level: 'COUNTRY',
  countryCode: 'KE',
  centroidLat: -1.28,
  centroidLng: 36.82,
  geojson: SAMPLE_GEOJSON,
};

const SAMPLE_MAP_LAYER_ROW = {
  id: 'layer-1',
  name: 'Admin Boundaries',
  description: 'test',
  layer_type: 'BOUNDARY',
  source_table: 'admin_boundaries',
  geometry_type: 'MultiPolygon',
  style: {},
  min_zoom: 1,
  max_zoom: 18,
  is_active: true,
  sort_order: 1,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
};

// ── Tests ──

describe('GeoService', () => {
  let service: GeoService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    service = new GeoService(prisma as any, redis as any);
  });

  // ── 1. listLayers — cache hit ──

  it('listLayers returns cached layers when cache hit', async () => {
    const cachedLayers = [
      {
        id: 'layer-1',
        name: 'Admin Boundaries',
        description: 'test',
        layerType: 'BOUNDARY',
        sourceTable: 'admin_boundaries',
        geometryType: 'MultiPolygon',
        style: {},
        minZoom: 1,
        maxZoom: 18,
        isActive: true,
        sortOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-06-01T00:00:00.000Z',
      },
    ];
    redis.get.mockResolvedValue(JSON.stringify(cachedLayers));

    const result = await service.listLayers();

    expect(result).toEqual({ data: cachedLayers });
    // Prisma should NOT be called when cache hit
    expect(prisma.mapLayer.findMany).not.toHaveBeenCalled();
    expect(redis.get).toHaveBeenCalledWith('geo:layers');
  });

  // ── 2. listLayers — cache miss, queries Prisma ──

  it('listLayers queries Prisma mapLayer.findMany on cache miss and maps to LayerEntity', async () => {
    redis.get.mockResolvedValue(null);
    prisma.mapLayer.findMany.mockResolvedValue([SAMPLE_MAP_LAYER_ROW]);

    const result = await service.listLayers();

    expect(prisma.mapLayer.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    // Verify camelCase mapping
    expect(result.data).toHaveLength(1);
    const layer = result.data[0];
    expect(layer.id).toBe('layer-1');
    expect(layer.name).toBe('Admin Boundaries');
    expect(layer.layerType).toBe('BOUNDARY');
    expect(layer.sourceTable).toBe('admin_boundaries');
    expect(layer.geometryType).toBe('MultiPolygon');
    expect(layer.minZoom).toBe(1);
    expect(layer.maxZoom).toBe(18);
    expect(layer.isActive).toBe(true);
    expect(layer.sortOrder).toBe(1);

    // Verify cache was populated
    expect(redis.set).toHaveBeenCalledWith(
      'geo:layers',
      expect.any(String),
      'EX',
      CACHE_TTL_LAYERS,
    );
  });

  // ── 3. queryWithin — calls $queryRaw and returns GeoJSON FeatureCollection ──

  it('queryWithin calls $queryRaw with ST_MakeEnvelope and returns GeoJSON FeatureCollection', async () => {
    prisma.$queryRaw.mockResolvedValue([SAMPLE_SPATIAL_ROW]);

    const result = await service.queryWithin({
      minLng: 33.0,
      minLat: -5.0,
      maxLng: 42.0,
      maxLat: 6.0,
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();

    const data = result.data;
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(1);

    const feature = data.features[0];
    expect(feature.type).toBe('Feature');
    expect(feature.geometry).toEqual(JSON.parse(SAMPLE_GEOJSON));
    expect(feature.properties).toEqual({
      id: 'uuid-1',
      code: 'KE',
      name: 'Kenya',
      level: 'COUNTRY',
      countryCode: 'KE',
    });

    // Verify cache was set
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('geo:within:'),
      expect.any(String),
      'EX',
      CACHE_TTL_WITHIN,
    );
  });

  // ── 4. queryWithin — cache hit ──

  it('queryWithin returns cached data on cache hit', async () => {
    const cachedCollection = buildFeatureCollection([
      buildFeature(SAMPLE_GEOJSON, { id: 'uuid-1', code: 'KE', name: 'Kenya' }),
    ]);
    redis.get.mockResolvedValue(JSON.stringify(cachedCollection));

    const result = await service.queryWithin({
      minLng: 33.0,
      minLat: -5.0,
      maxLng: 42.0,
      maxLat: 6.0,
    });

    expect(result.data.type).toBe('FeatureCollection');
    expect(result.data.features).toHaveLength(1);
    // Prisma should NOT be called on cache hit
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  // ── 5. queryNearest — calls $queryRaw with ST_DWithin and ST_MakePoint ──

  it('queryNearest calls $queryRaw with ST_DWithin and returns sorted features', async () => {
    const nearbyRows = [
      { ...SAMPLE_SPATIAL_ROW, id: 'uuid-near-1', code: 'KE-NBI', name: 'Nairobi', distance: 1200 },
      { ...SAMPLE_SPATIAL_ROW, id: 'uuid-near-2', code: 'KE-MBS', name: 'Mombasa', distance: 48000 },
    ];
    prisma.$queryRaw.mockResolvedValue(nearbyRows);

    const result = await service.queryNearest({
      lat: -1.28,
      lng: 36.82,
      level: 'ADMIN1',
      maxDistance: 50000,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();

    const data = result.data;
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(2);

    // Distances should be rounded
    expect(data.features[0].properties.distance).toBe(1200);
    expect(data.features[1].properties.distance).toBe(48000);

    // Verify cache was set
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('geo:nearest:'),
      expect.any(String),
      'EX',
      CACHE_TTL_NEAREST,
    );
  });

  // ── 6. queryContains — calls $queryRaw with ST_Contains ──

  it('queryContains calls $queryRaw with ST_Contains and returns admin hierarchy', async () => {
    const containsRows = [
      { code: 'KE-NBI-001', name: 'Kibera', level: 'ADMIN3', countryCode: 'KE' },
      { code: 'KE-NBI', name: 'Nairobi', level: 'ADMIN2', countryCode: 'KE' },
      { code: 'KE-047', name: 'Nairobi County', level: 'ADMIN1', countryCode: 'KE' },
      { code: 'KE', name: 'Kenya', level: 'COUNTRY', countryCode: 'KE' },
    ];
    prisma.$queryRaw.mockResolvedValue(containsRows);

    const result = await service.queryContains({
      lat: -1.3126,
      lng: 36.7838,
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.data).toHaveLength(4);

    // Should be ordered from most specific to least specific
    expect(result.data[0].level).toBe('ADMIN3');
    expect(result.data[1].level).toBe('ADMIN2');
    expect(result.data[2].level).toBe('ADMIN1');
    expect(result.data[3].level).toBe('COUNTRY');

    // Verify cache set
    expect(redis.set).toHaveBeenCalledWith(
      'geo:contains:-1.3126:36.7838',
      expect.any(String),
      'EX',
      CACHE_TTL_CONTAINS,
    );
  });

  // ── 7. getRiskMap — joins geo_events with admin_boundaries ──

  it('getRiskMap calls $queryRaw joining geo_events with admin_boundaries', async () => {
    const riskRows = [
      {
        code: 'KE-047',
        name: 'Nairobi County',
        country_code: 'KE',
        event_count: BigInt(12),
        geojson: SAMPLE_GEOJSON,
      },
      {
        code: 'KE-030',
        name: 'Mombasa County',
        country_code: 'KE',
        event_count: BigInt(0),
        geojson: SAMPLE_GEOJSON,
      },
    ];
    prisma.$queryRaw.mockResolvedValue(riskRows);

    const result = await service.getRiskMap({
      diseaseId: 'disease-uuid-1',
      periodStart: '2024-01-01',
      periodEnd: '2024-06-30',
      countryCode: 'KE',
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();

    const data = result.data;
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(2);

    // Verify severity classification
    const nairobiProps = data.features[0].properties;
    expect(nairobiProps.code).toBe('KE-047');
    expect(nairobiProps.eventCount).toBe(12);
    expect(nairobiProps.severity).toBe(classifySeverity(12)); // MODERATE

    const mombasaProps = data.features[1].properties;
    expect(mombasaProps.eventCount).toBe(0);
    expect(mombasaProps.severity).toBe('NONE');

    // Verify cache set
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('geo:risk:'),
      expect.any(String),
      'EX',
      CACHE_TTL_RISK_MAP,
    );
  });

  // ── 8. getAdminBoundary — returns feature for existing boundary code ──

  it('getAdminBoundary returns feature for existing boundary code', async () => {
    const boundaryRow = {
      id: 'uuid-1',
      code: 'KE-047',
      name: 'Nairobi County',
      name_en: 'Nairobi County',
      name_fr: 'Comte de Nairobi',
      level: 'ADMIN1',
      parent_code: 'KE',
      country_code: 'KE',
      centroid_lat: -1.2864,
      centroid_lng: 36.8172,
      geojson: SAMPLE_GEOJSON,
    };
    prisma.$queryRaw.mockResolvedValue([boundaryRow]);

    const result = await service.getAdminBoundary('KE-047');

    expect(prisma.$queryRaw).toHaveBeenCalled();

    const feature = result.data;
    expect(feature.type).toBe('Feature');
    expect(feature.geometry).toEqual(JSON.parse(SAMPLE_GEOJSON));
    expect(feature.properties).toEqual({
      id: 'uuid-1',
      code: 'KE-047',
      name: 'Nairobi County',
      nameEn: 'Nairobi County',
      nameFr: 'Comte de Nairobi',
      level: 'ADMIN1',
      parentCode: 'KE',
      countryCode: 'KE',
      centroidLat: -1.2864,
      centroidLng: 36.8172,
    });

    // Verify cache set
    expect(redis.set).toHaveBeenCalledWith(
      'geo:boundary:KE-047',
      expect.any(String),
      'EX',
      CACHE_TTL_BOUNDARY,
    );
  });

  // ── 9. getAdminBoundary — throws HttpError 404 for non-existent code ──

  it('getAdminBoundary throws HttpError 404 for non-existent code', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    try {
      await service.getAdminBoundary('NONEXISTENT');
      // Should not reach here
      expect.fail('Expected error to be thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('HttpError');
      expect(error.message).toContain('NONEXISTENT');
      expect(error.message).toContain('not found');
    }
  });

  // ── 10. queryNearest — uses default limit and maxDistance when not provided ──

  it('queryNearest uses default limit (5) and maxDistance (100000) when not provided', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { ...SAMPLE_SPATIAL_ROW, distance: 5000 },
    ]);

    const result = await service.queryNearest({
      lat: -1.28,
      lng: 36.82,
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();

    // The cache key encodes the defaults: limit=5, maxDistance=100000
    expect(redis.set).toHaveBeenCalledWith(
      'geo:nearest:-1.28:36.82:all:100000:5',
      expect.any(String),
      'EX',
      CACHE_TTL_NEAREST,
    );

    // Still produces a valid FeatureCollection
    const data = result.data;
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties.distance).toBe(5000);
  });
});
