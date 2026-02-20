import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Integration test — starts a PostGIS container, creates the geo_services schema
 * with PostGIS extensions, seeds admin boundaries with real geometries,
 * then exercises spatial queries: within, nearest, contains, risk map.
 */

let pgContainer: StartedTestContainer;
let prisma: PrismaClient;
let databaseUrl: string;

describe('Geo Service — Integration (PostGIS spatial queries)', () => {
  beforeAll(async () => {
    // Start PostGIS container (includes PostGIS extension)
    pgContainer = await new GenericContainer('postgis/postgis:16-3.4-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_USER: 'aris',
        POSTGRES_PASSWORD: 'aris',
        POSTGRES_DB: 'aris_test',
      })
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .start();

    const pgHost = pgContainer.getHost();
    const pgPort = pgContainer.getMappedPort(5432);
    databaseUrl = `postgresql://aris:aris@${pgHost}:${pgPort}/aris_test`;

    process.env['DATABASE_URL'] = databaseUrl;

    // Push Prisma schema
    const schemaPath = require.resolve('@aris/db-schemas/prisma/schema.prisma').replace(/schema\.prisma$/, '');
    execSync(`npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    // Enable PostGIS in the geo_services schema
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');

    // Add geometry columns (Prisma Unsupported types create the column but we need the spatial index)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom
        ON geo_services.admin_boundaries USING GIST (geom)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_geo_events_geom
        ON geo_services.geo_events USING GIST (geom)
    `);

    // Seed admin boundaries with simple geometries
    // Kenya country boundary (simplified rectangle)
    await prisma.$executeRawUnsafe(`
      INSERT INTO geo_services.admin_boundaries (id, code, name, name_en, name_fr, level, parent_code, country_code, centroid_lat, centroid_lng, properties, geom)
      VALUES (
        'a0000000-0000-4000-a000-000000000001', 'KE', 'Kenya', 'Kenya', 'Kenya',
        'COUNTRY', NULL, 'KE', 0.0, 38.0, '{}',
        ST_GeomFromText('MULTIPOLYGON(((33.9 -4.7, 41.9 -4.7, 41.9 5.0, 33.9 5.0, 33.9 -4.7)))', 4326)
      )
    `);

    // Nairobi province (ADMIN1)
    await prisma.$executeRawUnsafe(`
      INSERT INTO geo_services.admin_boundaries (id, code, name, name_en, name_fr, level, parent_code, country_code, centroid_lat, centroid_lng, properties, geom)
      VALUES (
        'a0000000-0000-4000-a000-000000000002', 'KE-NBI', 'Nairobi', 'Nairobi', 'Nairobi',
        'ADMIN1', 'KE', 'KE', -1.3, 36.82, '{}',
        ST_GeomFromText('MULTIPOLYGON(((36.65 -1.45, 37.0 -1.45, 37.0 -1.15, 36.65 -1.15, 36.65 -1.45)))', 4326)
      )
    `);

    // Westlands sub-county (ADMIN2)
    await prisma.$executeRawUnsafe(`
      INSERT INTO geo_services.admin_boundaries (id, code, name, name_en, name_fr, level, parent_code, country_code, centroid_lat, centroid_lng, properties, geom)
      VALUES (
        'a0000000-0000-4000-a000-000000000003', 'KE-NBI-001', 'Westlands', 'Westlands', 'Westlands',
        'ADMIN2', 'KE-NBI', 'KE', -1.26, 36.81, '{}',
        ST_GeomFromText('MULTIPOLYGON(((36.75 -1.30, 36.85 -1.30, 36.85 -1.22, 36.75 -1.22, 36.75 -1.30)))', 4326)
      )
    `);

    // Langata sub-county (ADMIN2)
    await prisma.$executeRawUnsafe(`
      INSERT INTO geo_services.admin_boundaries (id, code, name, name_en, name_fr, level, parent_code, country_code, centroid_lat, centroid_lng, properties, geom)
      VALUES (
        'a0000000-0000-4000-a000-000000000004', 'KE-NBI-002', 'Langata', 'Langata', 'Langata',
        'ADMIN2', 'KE-NBI', 'KE', -1.37, 36.75, '{}',
        ST_GeomFromText('MULTIPOLYGON(((36.70 -1.42, 36.82 -1.42, 36.82 -1.32, 36.70 -1.32, 36.70 -1.42)))', 4326)
      )
    `);

    // Ethiopia country boundary (simplified)
    await prisma.$executeRawUnsafe(`
      INSERT INTO geo_services.admin_boundaries (id, code, name, name_en, name_fr, level, parent_code, country_code, centroid_lat, centroid_lng, properties, geom)
      VALUES (
        'a0000000-0000-4000-a000-000000000005', 'ET', 'Ethiopia', 'Ethiopia', 'Ethiopie',
        'COUNTRY', NULL, 'ET', 9.0, 38.7, '{}',
        ST_GeomFromText('MULTIPOLYGON(((33.0 3.4, 48.0 3.4, 48.0 14.9, 33.0 14.9, 33.0 3.4)))', 4326)
      )
    `);

    // Seed geo_events for risk map testing
    // 3 events in Westlands
    for (let i = 0; i < 3; i++) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO geo_services.geo_events (id, tenant_id, entity_type, entity_id, disease_id, latitude, longitude, occurred_at, properties, geom)
        VALUES (
          gen_random_uuid(),
          'b0000000-0000-4000-b000-000000000001',
          'health_event',
          gen_random_uuid(),
          'd0000000-0000-4000-d000-000000000001',
          ${-1.26 + i * 0.01},
          ${36.80 + i * 0.01},
          '2024-03-15'::timestamptz,
          '{}',
          ST_SetSRID(ST_MakePoint(${36.80 + i * 0.01}, ${-1.26 + i * 0.01}), 4326)
        )
      `);
    }

    // 1 event in Langata
    await prisma.$executeRawUnsafe(`
      INSERT INTO geo_services.geo_events (id, tenant_id, entity_type, entity_id, disease_id, latitude, longitude, occurred_at, properties, geom)
      VALUES (
        gen_random_uuid(),
        'b0000000-0000-4000-b000-000000000001',
        'health_event',
        gen_random_uuid(),
        'd0000000-0000-4000-d000-000000000001',
        -1.37, 36.76,
        '2024-03-20'::timestamptz,
        '{}',
        ST_SetSRID(ST_MakePoint(36.76, -1.37), 4326)
      )
    `);

    // Seed a map layer
    await prisma.mapLayer.create({
      data: {
        name: 'admin-boundaries',
        description: 'Administrative boundaries',
        layer_type: 'BOUNDARY',
        source_table: 'admin_boundaries',
        geometry_type: 'MultiPolygon',
        style: {},
        min_zoom: 0,
        max_zoom: 18,
        is_active: true,
        sort_order: 1,
      },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  }, 30_000);

  async function createGeoService() {
    const { GeoService } = await import('../geo/geo.service');

    // Mock Redis (no-op for integration tests)
    const mockRedis = {
      get: async () => null,
      set: async () => undefined,
      del: async () => 1,
      delPattern: async () => 0,
      getClient: () => null,
    };

    return new GeoService(prisma as never, mockRedis as never);
  }

  it('listLayers returns seeded layers', async () => {
    const service = await createGeoService();
    const result = await service.listLayers();

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].name).toBe('admin-boundaries');
    expect(result.data[0].layerType).toBe('BOUNDARY');
  });

  it('queryWithin returns boundaries intersecting bounding box', async () => {
    const service = await createGeoService();

    // Bounding box covering Nairobi area
    const result = await service.queryWithin({
      minLng: 36.6,
      minLat: -1.5,
      maxLng: 37.1,
      maxLat: -1.1,
    });

    expect(result.data.type).toBe('FeatureCollection');
    // Should find: KE (country), KE-NBI (admin1), KE-NBI-001, KE-NBI-002 (admin2)
    expect(result.data.features.length).toBeGreaterThanOrEqual(3);

    const codes = result.data.features.map((f) => f.properties.code);
    expect(codes).toContain('KE-NBI');
    expect(codes).toContain('KE-NBI-001');
  });

  it('queryWithin with level filter returns only that level', async () => {
    const service = await createGeoService();

    const result = await service.queryWithin({
      minLng: 36.6,
      minLat: -1.5,
      maxLng: 37.1,
      maxLat: -1.1,
      level: 'ADMIN2',
    });

    expect(result.data.features.length).toBe(2);
    result.data.features.forEach((f) => {
      expect(f.properties.level).toBe('ADMIN2');
    });
  });

  it('queryNearest returns boundaries ordered by distance', async () => {
    const service = await createGeoService();

    // Point in Westlands — Westlands should be nearest ADMIN2
    const result = await service.queryNearest({
      lat: -1.26,
      lng: 36.80,
      level: 'ADMIN2',
      limit: 2,
    });

    expect(result.data.type).toBe('FeatureCollection');
    expect(result.data.features.length).toBe(2);

    // Westlands should be first (closest)
    expect(result.data.features[0].properties.code).toBe('KE-NBI-001');
    // Langata should be second
    expect(result.data.features[1].properties.code).toBe('KE-NBI-002');

    // First should have smaller distance
    const d0 = result.data.features[0].properties.distance as number;
    const d1 = result.data.features[1].properties.distance as number;
    expect(d0).toBeLessThan(d1);
  });

  it('queryContains returns hierarchy for point in Westlands', async () => {
    const service = await createGeoService();

    // Point inside Westlands
    const result = await service.queryContains({ lat: -1.26, lng: 36.80 });

    expect(result.data.length).toBeGreaterThanOrEqual(2);

    const levels = result.data.map((r) => r.level);
    // Should include ADMIN2 (Westlands), ADMIN1 (Nairobi), COUNTRY (Kenya)
    expect(levels).toContain('ADMIN2');
    expect(levels).toContain('ADMIN1');
    expect(levels).toContain('COUNTRY');

    // Most specific (ADMIN2/ADMIN3) should come first
    const firstIdx = levels.indexOf('ADMIN2');
    const countryIdx = levels.indexOf('COUNTRY');
    expect(firstIdx).toBeLessThan(countryIdx);
  });

  it('queryContains returns empty for point in Indian Ocean', async () => {
    const service = await createGeoService();

    const result = await service.queryContains({ lat: -5.0, lng: 50.0 });

    expect(result.data).toHaveLength(0);
  });

  it('getRiskMap returns FeatureCollection with event counts per ADMIN2', async () => {
    const service = await createGeoService();

    const result = await service.getRiskMap({
      diseaseId: 'd0000000-0000-4000-d000-000000000001',
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
      countryCode: 'KE',
      adminLevel: 'ADMIN2',
    });

    expect(result.data.type).toBe('FeatureCollection');

    // We have 2 ADMIN2 zones in Kenya
    expect(result.data.features.length).toBe(2);

    const westlands = result.data.features.find((f) => f.properties.code === 'KE-NBI-001');
    const langata = result.data.features.find((f) => f.properties.code === 'KE-NBI-002');

    expect(westlands).toBeDefined();
    expect(westlands!.properties.eventCount).toBe(3);
    expect(westlands!.properties.severity).toBe('LOW');

    expect(langata).toBeDefined();
    expect(langata!.properties.eventCount).toBe(1);
    expect(langata!.properties.severity).toBe('LOW');
  });

  it('getRiskMap returns NONE severity for zones with no events', async () => {
    const service = await createGeoService();

    // Use a disease that has no events
    const result = await service.getRiskMap({
      diseaseId: 'f0000000-0000-4000-f000-000000000099',
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
      countryCode: 'KE',
      adminLevel: 'ADMIN2',
    });

    result.data.features.forEach((f) => {
      expect(f.properties.eventCount).toBe(0);
      expect(f.properties.severity).toBe('NONE');
    });
  });

  it('getAdminBoundary returns GeoJSON for Kenya', async () => {
    const service = await createGeoService();
    const result = await service.getAdminBoundary('KE');

    expect(result.data.type).toBe('Feature');
    expect(result.data.geometry.type).toBe('MultiPolygon');
    expect(result.data.properties.code).toBe('KE');
    expect(result.data.properties.nameEn).toBe('Kenya');
    expect(result.data.properties.nameFr).toBe('Kenya');
    expect(result.data.properties.level).toBe('COUNTRY');
  });

  it('getAdminBoundary throws for nonexistent code', async () => {
    const service = await createGeoService();

    await expect(
      service.getAdminBoundary('XX-FAKE'),
    ).rejects.toThrow('Admin boundary with code "XX-FAKE" not found');
  });
});
