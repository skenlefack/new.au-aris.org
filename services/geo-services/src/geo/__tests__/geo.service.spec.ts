import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GeoService } from '../geo.service';
import {
  classifySeverity,
  buildFeature,
  buildFeatureCollection,
  CACHE_TTL_LAYERS,
  CACHE_TTL_RISK_MAP,
  CACHE_TTL_BOUNDARY,
  CACHE_TTL_WITHIN,
  CACHE_TTL_NEAREST,
  CACHE_TTL_CONTAINS,
} from '../entities/geo.entity';
import type {
  GeoJsonFeatureCollection,
  GeoJsonFeature,
  RiskZoneProperties,
} from '../entities/geo.entity';

// ── Mock factories ──

function mockPrismaService() {
  return {
    mapLayer: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
}

function mockRedisService() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
    delPattern: vi.fn().mockResolvedValue(0),
    getClient: vi.fn(),
  };
}

// ── Tests ──

describe('GeoService', () => {
  let service: GeoService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let redis: ReturnType<typeof mockRedisService>;

  beforeEach(() => {
    prisma = mockPrismaService();
    redis = mockRedisService();
    service = new GeoService(prisma as never, redis as never);
  });

  // ── classifySeverity ──

  describe('classifySeverity', () => {
    it('should return NONE for 0 events', () => {
      expect(classifySeverity(0)).toBe('NONE');
    });

    it('should return LOW for 1-5 events', () => {
      expect(classifySeverity(1)).toBe('LOW');
      expect(classifySeverity(5)).toBe('LOW');
    });

    it('should return MODERATE for 6-20 events', () => {
      expect(classifySeverity(6)).toBe('MODERATE');
      expect(classifySeverity(20)).toBe('MODERATE');
    });

    it('should return HIGH for 21-50 events', () => {
      expect(classifySeverity(21)).toBe('HIGH');
      expect(classifySeverity(50)).toBe('HIGH');
    });

    it('should return CRITICAL for 51+ events', () => {
      expect(classifySeverity(51)).toBe('CRITICAL');
      expect(classifySeverity(1000)).toBe('CRITICAL');
    });
  });

  // ── buildFeature ──

  describe('buildFeature', () => {
    it('should create a valid GeoJSON Feature', () => {
      const geojson = '{"type":"Point","coordinates":[36.8,-1.3]}';
      const props = { name: 'Nairobi', code: 'KE-NBI' };

      const feature = buildFeature(geojson, props);

      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Point');
      expect(feature.geometry.coordinates).toEqual([36.8, -1.3]);
      expect(feature.properties.name).toBe('Nairobi');
      expect(feature.properties.code).toBe('KE-NBI');
    });

    it('should handle MultiPolygon geometry', () => {
      const geojson = '{"type":"MultiPolygon","coordinates":[[[[30,10],[40,40],[20,40],[10,20],[30,10]]]]}';
      const feature = buildFeature(geojson, { id: 'test' });

      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('MultiPolygon');
    });
  });

  // ── buildFeatureCollection ──

  describe('buildFeatureCollection', () => {
    it('should create a valid GeoJSON FeatureCollection', () => {
      const features: GeoJsonFeature[] = [
        buildFeature('{"type":"Point","coordinates":[36.8,-1.3]}', { name: 'A' }),
        buildFeature('{"type":"Point","coordinates":[37.0,-1.5]}', { name: 'B' }),
      ];

      const fc = buildFeatureCollection(features);

      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features).toHaveLength(2);
      expect(fc.features[0].properties.name).toBe('A');
      expect(fc.features[1].properties.name).toBe('B');
    });

    it('should create empty FeatureCollection', () => {
      const fc = buildFeatureCollection([]);

      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features).toHaveLength(0);
    });
  });

  // ── listLayers ──

  describe('listLayers', () => {
    it('should return active layers sorted by sort_order', async () => {
      prisma.mapLayer.findMany.mockResolvedValue([
        {
          id: 'layer-1',
          name: 'admin-boundaries',
          description: 'Administrative boundaries',
          layer_type: 'BOUNDARY',
          source_table: 'admin_boundaries',
          geometry_type: 'MultiPolygon',
          style: { fillColor: '#ccc' },
          min_zoom: 0,
          max_zoom: 18,
          is_active: true,
          sort_order: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'layer-2',
          name: 'disease-risk',
          description: 'Disease risk heatmap',
          layer_type: 'RISK',
          source_table: 'geo_events',
          geometry_type: 'Polygon',
          style: { opacity: 0.7 },
          min_zoom: 3,
          max_zoom: 12,
          is_active: true,
          sort_order: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.listLayers();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('admin-boundaries');
      expect(result.data[0].layerType).toBe('BOUNDARY');
      expect(result.data[1].name).toBe('disease-risk');
      expect(result.data[1].layerType).toBe('RISK');
    });

    it('should return cached layers on second call', async () => {
      const cachedData = JSON.stringify([{ id: 'layer-1', name: 'cached-layer' }]);
      redis.get.mockResolvedValue(cachedData);

      const result = await service.listLayers();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('cached-layer');
      expect(prisma.mapLayer.findMany).not.toHaveBeenCalled();
    });

    it('should cache results with correct TTL', async () => {
      prisma.mapLayer.findMany.mockResolvedValue([]);

      await service.listLayers();

      expect(redis.set).toHaveBeenCalledWith(
        'geo:layers',
        '[]',
        CACHE_TTL_LAYERS,
      );
    });
  });

  // ── queryWithin ──

  describe('queryWithin', () => {
    it('should return FeatureCollection for bounding box query', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'b-1',
          code: 'KE-NBI',
          name: 'Nairobi',
          level: 'ADMIN1',
          countryCode: 'KE',
          centroidLat: -1.3,
          centroidLng: 36.8,
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.7,-1.2],[36.9,-1.2],[36.9,-1.4],[36.7,-1.4],[36.7,-1.2]]]]}',
        },
      ]);

      const result = await service.queryWithin({
        minLng: 36.5,
        minLat: -1.5,
        maxLng: 37.0,
        maxLat: -1.0,
      });

      expect(result.data.type).toBe('FeatureCollection');
      expect(result.data.features).toHaveLength(1);
      expect(result.data.features[0].properties.code).toBe('KE-NBI');
    });

    it('should cache within results', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.queryWithin({
        minLng: 36.0,
        minLat: -2.0,
        maxLng: 37.0,
        maxLat: -1.0,
      });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('geo:within:'),
        expect.any(String),
        CACHE_TTL_WITHIN,
      );
    });
  });

  // ── queryNearest ──

  describe('queryNearest', () => {
    it('should return nearest entities with distance', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'b-1',
          code: 'KE-NBI',
          name: 'Nairobi',
          level: 'ADMIN1',
          countryCode: 'KE',
          centroidLat: -1.3,
          centroidLng: 36.8,
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.7,-1.2],[36.9,-1.2],[36.9,-1.4],[36.7,-1.4],[36.7,-1.2]]]]}',
          distance: 15234.5,
        },
      ]);

      const result = await service.queryNearest({ lat: -1.28, lng: 36.82 });

      expect(result.data.type).toBe('FeatureCollection');
      expect(result.data.features).toHaveLength(1);
      expect(result.data.features[0].properties.distance).toBe(15235); // rounded
      expect(result.data.features[0].properties.code).toBe('KE-NBI');
    });

    it('should cache nearest results', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.queryNearest({ lat: -1.28, lng: 36.82 });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('geo:nearest:'),
        expect.any(String),
        CACHE_TTL_NEAREST,
      );
    });
  });

  // ── queryContains ──

  describe('queryContains', () => {
    it('should return all boundaries containing the point (most specific first)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { code: 'KE-NBI-001', name: 'Westlands', level: 'ADMIN2', countryCode: 'KE' },
        { code: 'KE-NBI', name: 'Nairobi', level: 'ADMIN1', countryCode: 'KE' },
        { code: 'KE', name: 'Kenya', level: 'COUNTRY', countryCode: 'KE' },
      ]);

      const result = await service.queryContains({ lat: -1.26, lng: 36.80 });

      expect(result.data).toHaveLength(3);
      expect(result.data[0].level).toBe('ADMIN2');
      expect(result.data[1].level).toBe('ADMIN1');
      expect(result.data[2].level).toBe('COUNTRY');
    });

    it('should return empty array for point in ocean', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.queryContains({ lat: 0, lng: 0 });

      expect(result.data).toHaveLength(0);
    });

    it('should cache contains results', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.queryContains({ lat: -1.26, lng: 36.80 });

      expect(redis.set).toHaveBeenCalledWith(
        'geo:contains:-1.26:36.8',
        expect.any(String),
        CACHE_TTL_CONTAINS,
      );
    });
  });

  // ── getRiskMap ──

  describe('getRiskMap', () => {
    it('should return FeatureCollection with severity classification', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          code: 'KE-NBI-001',
          name: 'Westlands',
          country_code: 'KE',
          event_count: BigInt(3),
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.7,-1.2],[36.9,-1.2],[36.9,-1.4],[36.7,-1.4],[36.7,-1.2]]]]}',
        },
        {
          code: 'KE-NBI-002',
          name: 'Langata',
          country_code: 'KE',
          event_count: BigInt(25),
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.6,-1.3],[36.8,-1.3],[36.8,-1.5],[36.6,-1.5],[36.6,-1.3]]]]}',
        },
        {
          code: 'KE-NBI-003',
          name: 'Kasarani',
          country_code: 'KE',
          event_count: BigInt(0),
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.8,-1.1],[37.0,-1.1],[37.0,-1.3],[36.8,-1.3],[36.8,-1.1]]]]}',
        },
        {
          code: 'KE-NBI-004',
          name: 'Embakasi',
          country_code: 'KE',
          event_count: BigInt(55),
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.9,-1.2],[37.1,-1.2],[37.1,-1.4],[36.9,-1.4],[36.9,-1.2]]]]}',
        },
      ]);

      const result = await service.getRiskMap({
        diseaseId: '00000000-0000-4000-a000-000000000001',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
      });

      expect(result.data.type).toBe('FeatureCollection');
      expect(result.data.features).toHaveLength(4);

      // Check severity classification
      const severities = result.data.features.map((f) => f.properties.severity);
      expect(severities).toEqual(['LOW', 'HIGH', 'NONE', 'CRITICAL']);

      // Check event counts (bigint → number conversion)
      expect(result.data.features[0].properties.eventCount).toBe(3);
      expect(result.data.features[1].properties.eventCount).toBe(25);
    });

    it('should filter out rows with null geojson', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          code: 'KE-NBI-001',
          name: 'Westlands',
          country_code: 'KE',
          event_count: BigInt(5),
          geojson: '{"type":"MultiPolygon","coordinates":[[[[36.7,-1.2],[36.9,-1.2],[36.9,-1.4],[36.7,-1.4],[36.7,-1.2]]]]}',
        },
        {
          code: 'KE-NBI-002',
          name: 'NoGeom',
          country_code: 'KE',
          event_count: BigInt(0),
          geojson: null,
        },
      ]);

      const result = await service.getRiskMap({
        diseaseId: '00000000-0000-4000-a000-000000000001',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
      });

      expect(result.data.features).toHaveLength(1);
      expect(result.data.features[0].properties.code).toBe('KE-NBI-001');
    });

    it('should cache risk map with 5-minute TTL', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getRiskMap({
        diseaseId: '00000000-0000-4000-a000-000000000001',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
      });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('geo:risk:'),
        expect.any(String),
        CACHE_TTL_RISK_MAP,
      );
    });

    it('should use cached risk map when available', async () => {
      const cachedRiskMap: GeoJsonFeatureCollection<RiskZoneProperties> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'MultiPolygon', coordinates: [] },
            properties: { code: 'KE-001', name: 'Cached', countryCode: 'KE', eventCount: 10, severity: 'MODERATE' },
          },
        ],
      };
      redis.get.mockResolvedValue(JSON.stringify(cachedRiskMap));

      const result = await service.getRiskMap({
        diseaseId: '00000000-0000-4000-a000-000000000001',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
      });

      expect(result.data.features).toHaveLength(1);
      expect(result.data.features[0].properties.code).toBe('KE-001');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ── getAdminBoundary ──

  describe('getAdminBoundary', () => {
    it('should return GeoJSON Feature for a boundary code', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'b-1',
          code: 'KE',
          name: 'Kenya',
          name_en: 'Kenya',
          name_fr: 'Kenya',
          level: 'COUNTRY',
          parent_code: null,
          country_code: 'KE',
          centroid_lat: -0.023559,
          centroid_lng: 37.906193,
          geojson: '{"type":"MultiPolygon","coordinates":[[[[33.9,-4.7],[41.9,-4.7],[41.9,5.0],[33.9,5.0],[33.9,-4.7]]]]}',
        },
      ]);

      const result = await service.getAdminBoundary('KE');

      expect(result.data.type).toBe('Feature');
      expect(result.data.geometry.type).toBe('MultiPolygon');
      expect(result.data.properties.code).toBe('KE');
      expect(result.data.properties.nameEn).toBe('Kenya');
      expect(result.data.properties.centroidLat).toBe(-0.023559);
    });

    it('should throw NotFoundException for unknown code', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.getAdminBoundary('XX-NONEXISTENT'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cache boundary with 1-hour TTL', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'b-1',
          code: 'KE',
          name: 'Kenya',
          name_en: 'Kenya',
          name_fr: 'Kenya',
          level: 'COUNTRY',
          parent_code: null,
          country_code: 'KE',
          centroid_lat: null,
          centroid_lng: null,
          geojson: '{"type":"MultiPolygon","coordinates":[]}',
        },
      ]);

      await service.getAdminBoundary('KE');

      expect(redis.set).toHaveBeenCalledWith(
        'geo:boundary:KE',
        expect.any(String),
        CACHE_TTL_BOUNDARY,
      );
    });

    it('should return cached boundary', async () => {
      const cachedFeature: GeoJsonFeature = {
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: [] },
        properties: { code: 'KE', name: 'Cached Kenya' },
      };
      redis.get.mockResolvedValue(JSON.stringify(cachedFeature));

      const result = await service.getAdminBoundary('KE');

      expect(result.data.properties.name).toBe('Cached Kenya');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ── toLayerEntity ──

  describe('toLayerEntity', () => {
    it('should map snake_case to camelCase', () => {
      const entity = service.toLayerEntity({
        id: 'layer-1',
        name: 'test-layer',
        description: 'Test layer',
        layer_type: 'BOUNDARY',
        source_table: 'admin_boundaries',
        geometry_type: 'MultiPolygon',
        style: {},
        min_zoom: 2,
        max_zoom: 14,
        is_active: true,
        sort_order: 1,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-06-01'),
      });

      expect(entity.layerType).toBe('BOUNDARY');
      expect(entity.sourceTable).toBe('admin_boundaries');
      expect(entity.geometryType).toBe('MultiPolygon');
      expect(entity.minZoom).toBe(2);
      expect(entity.maxZoom).toBe(14);
      expect(entity.isActive).toBe(true);
      expect(entity.sortOrder).toBe(1);
    });
  });

  // ── Redis cache resilience ──

  describe('cache resilience', () => {
    it('should not fail when Redis read throws', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection lost'));
      prisma.mapLayer.findMany.mockResolvedValue([]);

      const result = await service.listLayers();

      expect(result.data).toEqual([]);
    });

    it('should not fail when Redis write throws', async () => {
      redis.set.mockRejectedValue(new Error('Redis connection lost'));
      prisma.mapLayer.findMany.mockResolvedValue([]);

      const result = await service.listLayers();

      expect(result.data).toEqual([]);
    });
  });
});
