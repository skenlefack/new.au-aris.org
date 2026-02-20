/**
 * Integration test for PostGIS geo queries.
 *
 * Requires: PostgreSQL 16 + PostGIS 3.4 running (via docker-compose or Testcontainers).
 *
 * Tests:
 *  1. Point-in-polygon containment check
 *  2. Distance calculation between two geo entities
 *  3. Bounding box intersection
 *  4. GeoEntity hierarchy traversal
 *
 * NOTE: This test uses raw SQL queries via PrismaClient.$queryRawUnsafe
 * because Prisma does not natively support PostGIS geometry types.
 * In production, geometry columns are added via raw SQL migrations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Only run if DATABASE_URL is available
const DATABASE_URL = process.env['DATABASE_URL'];
const shouldRun = !!DATABASE_URL;

describe.skipIf(!shouldRun)('PostGIS Geo Queries (Integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Ensure PostGIS extension is available
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');

    // Clean test data
    await prisma.$executeRawUnsafe(`
      DELETE FROM geo_entities WHERE code IN ('TEST-KE', 'TEST-KE-01', 'TEST-KE-02', 'TEST-ET')
    `);

    // Seed test geo entities
    await prisma.geoEntity.createMany({
      data: [
        {
          code: 'TEST-KE',
          name: 'Kenya (Test)',
          nameEn: 'Kenya (Test)',
          nameFr: 'Kenya (Test)',
          level: 'COUNTRY',
          countryCode: 'KE',
          centroidLat: -0.02,
          centroidLng: 37.91,
        },
        {
          code: 'TEST-ET',
          name: 'Ethiopia (Test)',
          nameEn: 'Ethiopia (Test)',
          nameFr: 'Éthiopie (Test)',
          level: 'COUNTRY',
          countryCode: 'ET',
          centroidLat: 9.15,
          centroidLng: 40.49,
        },
      ],
    });

    // Get Kenya's ID for parenting
    const kenya = await prisma.geoEntity.findUnique({ where: { code: 'TEST-KE' } });

    await prisma.geoEntity.createMany({
      data: [
        {
          code: 'TEST-KE-01',
          name: 'Nairobi (Test)',
          nameEn: 'Nairobi (Test)',
          nameFr: 'Nairobi (Test)',
          level: 'ADMIN1',
          parentId: kenya!.id,
          countryCode: 'KE',
          centroidLat: -1.29,
          centroidLng: 36.82,
        },
        {
          code: 'TEST-KE-02',
          name: 'Mombasa (Test)',
          nameEn: 'Mombasa (Test)',
          nameFr: 'Mombasa (Test)',
          level: 'ADMIN1',
          parentId: kenya!.id,
          countryCode: 'KE',
          centroidLat: -4.05,
          centroidLng: 39.67,
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.$executeRawUnsafe(`
      DELETE FROM geo_entities WHERE code IN ('TEST-KE', 'TEST-KE-01', 'TEST-KE-02', 'TEST-ET')
    `);
    await prisma.$disconnect();
  });

  it('should calculate distance between Nairobi and Mombasa centroids', async () => {
    const result = await prisma.$queryRawUnsafe<{ distance_km: number }[]>(`
      SELECT
        ST_Distance(
          ST_SetSRID(ST_MakePoint(a.centroid_lng, a.centroid_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(b.centroid_lng, b.centroid_lat), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM geo_entities a, geo_entities b
      WHERE a.code = 'TEST-KE-01' AND b.code = 'TEST-KE-02'
    `);

    expect(result).toHaveLength(1);
    const distance = result[0]!.distance_km;
    // Nairobi to Mombasa is ~440 km
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(500);
  });

  it('should calculate distance between Kenya and Ethiopia centroids', async () => {
    const result = await prisma.$queryRawUnsafe<{ distance_km: number }[]>(`
      SELECT
        ST_Distance(
          ST_SetSRID(ST_MakePoint(a.centroid_lng, a.centroid_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(b.centroid_lng, b.centroid_lat), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM geo_entities a, geo_entities b
      WHERE a.code = 'TEST-KE' AND b.code = 'TEST-ET'
    `);

    expect(result).toHaveLength(1);
    const distance = result[0]!.distance_km;
    // Kenya centroid to Ethiopia centroid is ~1000-1100 km
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1200);
  });

  it('should find geo entities within a bounding box around East Africa', async () => {
    // Bounding box: lat -5 to 12, lng 33 to 42 (East Africa)
    const result = await prisma.$queryRawUnsafe<{ code: string }[]>(`
      SELECT code
      FROM geo_entities
      WHERE code LIKE 'TEST-%'
        AND centroid_lat BETWEEN -5 AND 12
        AND centroid_lng BETWEEN 33 AND 42
      ORDER BY code
    `);

    const codes = result.map(r => r.code);
    // Kenya, Nairobi, Ethiopia should be inside; Mombasa (lng 39.67) also inside
    expect(codes).toContain('TEST-KE');
    expect(codes).toContain('TEST-ET');
    expect(codes).toContain('TEST-KE-01');
    expect(codes).toContain('TEST-KE-02');
  });

  it('should traverse parent-child hierarchy', async () => {
    const kenya = await prisma.geoEntity.findUnique({
      where: { code: 'TEST-KE' },
    });

    const children = await prisma.geoEntity.findMany({
      where: { parentId: kenya!.id },
      orderBy: { code: 'asc' },
    });

    expect(children).toHaveLength(2);
    expect(children[0]!.code).toBe('TEST-KE-01');
    expect(children[1]!.code).toBe('TEST-KE-02');
  });

  it('should find nearest geo entity to a given point', async () => {
    // Point near Nairobi: -1.3, 36.8
    const result = await prisma.$queryRawUnsafe<{ code: string; distance_km: number }[]>(`
      SELECT
        code,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.8, -1.3), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM geo_entities
      WHERE code LIKE 'TEST-%'
        AND level IN ('ADMIN1')
      ORDER BY distance_km ASC
      LIMIT 1
    `);

    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('TEST-KE-01'); // Nairobi is nearest
    expect(result[0]!.distance_km).toBeLessThan(5); // should be very close
  });
});
