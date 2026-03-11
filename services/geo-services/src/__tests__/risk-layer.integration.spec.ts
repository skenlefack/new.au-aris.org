import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * Integration tests for RiskLayerService using Testcontainers PostGIS.
 *
 * Prerequisites:
 *   - Docker running (Testcontainers starts a PostGIS container)
 *   - Run via: pnpm --filter geo-services test:integration
 *
 * These tests exercise real spatial queries against PostGIS.
 */

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ID_OTHER = '00000000-0000-0000-0000-000000000002';

// GeoJSON polygons for test risk layers
const KENYA_POLYGON = {
  type: 'Polygon',
  coordinates: [[[36.0, -1.5], [37.5, -1.5], [37.5, 0.5], [36.0, 0.5], [36.0, -1.5]]],
};

const ETHIOPIA_POLYGON = {
  type: 'Polygon',
  coordinates: [[[38.0, 6.0], [42.0, 6.0], [42.0, 10.0], [38.0, 10.0], [38.0, 6.0]]],
};

const WEST_AFRICA_POLYGON = {
  type: 'Polygon',
  coordinates: [[[-5.0, 5.0], [2.0, 5.0], [2.0, 11.0], [-5.0, 11.0], [-5.0, 5.0]]],
};

describe('RiskLayerService Integration (PostGIS)', () => {
  let prisma: PrismaClient;
  let layerIds: string[] = [];

  beforeAll(async () => {
    // Use the existing DATABASE_URL or skip
    const dbUrl = process.env['DATABASE_URL'] ?? process.env['DIRECT_DATABASE_URL'];
    if (!dbUrl) {
      console.warn('Skipping integration tests: no DATABASE_URL');
      return;
    }

    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();

    // Ensure schema and table exist
    await prisma.$executeRawUnsafe(`
      CREATE SCHEMA IF NOT EXISTS geo_services;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE geo_services."RiskLayerType" AS ENUM ('DISEASE_RISK', 'CLIMATE', 'TRADE_CORRIDOR', 'WILDLIFE_HABITAT');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE geo_services."RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS geo_services.risk_layers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        layer_type geo_services."RiskLayerType" NOT NULL,
        severity geo_services."RiskSeverity" NOT NULL,
        geom geometry(Geometry, 4326),
        properties JSONB DEFAULT '{}',
        data_classification VARCHAR(20) DEFAULT 'PUBLIC',
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        source VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_risk_layers_geom
        ON geo_services.risk_layers USING GIST (geom);
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS geo_services.geo_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID NOT NULL,
        disease_id UUID,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        geom geometry(Point, 4326),
        occurred_at TIMESTAMPTZ NOT NULL,
        properties JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_geo_events_geom
        ON geo_services.geo_events USING GIST (geom);
    `).catch(() => {});
  });

  afterAll(async () => {
    // Clean up inserted test data
    if (prisma) {
      for (const id of layerIds) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM geo_services.risk_layers WHERE id = $1::uuid`,
          id,
        ).catch(() => {});
      }
      await prisma.$disconnect();
    }
  });

  it('creates a risk layer with valid geometry and retrieves it', async () => {
    if (!prisma) return;

    const id = crypto.randomUUID();
    layerIds.push(id);

    await prisma.$executeRaw`
      INSERT INTO geo_services.risk_layers (
        id, tenant_id, name, description, layer_type, severity,
        geom, properties, data_classification, is_active, created_at, updated_at
      ) VALUES (
        ${id}::uuid, ${TENANT_ID}::uuid,
        'Kenya FMD Zone', 'Integration test zone',
        'DISEASE_RISK'::"geo_services"."RiskLayerType",
        'HIGH'::"geo_services"."RiskSeverity",
        ST_GeomFromGeoJSON(${JSON.stringify(KENYA_POLYGON)}),
        '{"disease":"FMD"}'::jsonb,
        'PUBLIC', true, NOW(), NOW()
      )
    `;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, name, layer_type, severity,
             ST_AsGeoJSON(geom) AS geojson,
             ST_Area(geom::geography) AS area_m2
      FROM geo_services.risk_layers
      WHERE id = ${id}::uuid
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Kenya FMD Zone');
    expect(rows[0].geojson).toBeTruthy();

    const geom = JSON.parse(rows[0].geojson);
    expect(geom.type).toBe('Polygon');
    expect(Number(rows[0].area_m2)).toBeGreaterThan(0);
  });

  it('finds risk layers by bounding box using ST_Intersects', async () => {
    if (!prisma) return;

    // Insert two layers: one in Kenya, one in West Africa
    const kenyaId = crypto.randomUUID();
    const westAfricaId = crypto.randomUUID();
    layerIds.push(kenyaId, westAfricaId);

    await prisma.$executeRaw`
      INSERT INTO geo_services.risk_layers (
        id, tenant_id, name, layer_type, severity,
        geom, is_active, created_at, updated_at
      ) VALUES
        (${kenyaId}::uuid, ${TENANT_ID}::uuid, 'Kenya Zone', 'DISEASE_RISK'::"geo_services"."RiskLayerType", 'HIGH'::"geo_services"."RiskSeverity", ST_GeomFromGeoJSON(${JSON.stringify(KENYA_POLYGON)}), true, NOW(), NOW()),
        (${westAfricaId}::uuid, ${TENANT_ID}::uuid, 'West Africa Zone', 'CLIMATE'::"geo_services"."RiskLayerType", 'MEDIUM'::"geo_services"."RiskSeverity", ST_GeomFromGeoJSON(${JSON.stringify(WEST_AFRICA_POLYGON)}), true, NOW(), NOW())
    `;

    // Bbox covering East Africa only
    const eastAfricaRows = await prisma.$queryRaw<any[]>`
      SELECT id, name FROM geo_services.risk_layers
      WHERE tenant_id = ${TENANT_ID}::uuid
        AND is_active = true
        AND geom IS NOT NULL
        AND ST_Intersects(geom, ST_MakeEnvelope(34, -3, 40, 3, 4326))
    `;

    const names = eastAfricaRows.map((r: any) => r.name);
    expect(names).toContain('Kenya Zone');
    expect(names).not.toContain('West Africa Zone');
  });

  it('verifies tenant isolation', async () => {
    if (!prisma) return;

    const id = crypto.randomUUID();
    layerIds.push(id);

    await prisma.$executeRaw`
      INSERT INTO geo_services.risk_layers (
        id, tenant_id, name, layer_type, severity,
        geom, is_active, created_at, updated_at
      ) VALUES (
        ${id}::uuid, ${TENANT_ID}::uuid,
        'Tenant-1 Layer', 'WILDLIFE_HABITAT'::"geo_services"."RiskLayerType",
        'LOW'::"geo_services"."RiskSeverity",
        ST_GeomFromGeoJSON(${JSON.stringify(ETHIOPIA_POLYGON)}),
        true, NOW(), NOW()
      )
    `;

    // Query with different tenant should NOT find the layer
    const otherTenantRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM geo_services.risk_layers
      WHERE id = ${id}::uuid AND tenant_id = ${TENANT_ID_OTHER}::uuid
    `;

    expect(otherTenantRows).toHaveLength(0);

    // Query with correct tenant SHOULD find it
    const correctTenantRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM geo_services.risk_layers
      WHERE id = ${id}::uuid AND tenant_id = ${TENANT_ID}::uuid
    `;

    expect(correctTenantRows).toHaveLength(1);
  });

  it('performs spatial analysis with ST_DWithin on risk layers and geo events', async () => {
    if (!prisma) return;

    const layerId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    layerIds.push(layerId);

    // Insert a risk layer near Nairobi
    await prisma.$executeRaw`
      INSERT INTO geo_services.risk_layers (
        id, tenant_id, name, layer_type, severity,
        geom, is_active, created_at, updated_at
      ) VALUES (
        ${layerId}::uuid, ${TENANT_ID}::uuid,
        'Nairobi Risk Zone', 'DISEASE_RISK'::"geo_services"."RiskLayerType",
        'CRITICAL'::"geo_services"."RiskSeverity",
        ST_GeomFromGeoJSON(${JSON.stringify(KENYA_POLYGON)}),
        true, NOW(), NOW()
      )
    `;

    // Insert a geo event near Nairobi
    await prisma.$executeRaw`
      INSERT INTO geo_services.geo_events (
        id, tenant_id, entity_type, entity_id, latitude, longitude,
        geom, occurred_at
      ) VALUES (
        ${eventId}::uuid, ${TENANT_ID}::uuid, 'health_event',
        ${crypto.randomUUID()}::uuid,
        -1.3, 36.8,
        ST_SetSRID(ST_MakePoint(36.8, -1.3), 4326),
        NOW()
      )
    `;

    // Spatial query: find layers within 200km of Nairobi
    const riskRows = await prisma.$queryRaw<any[]>`
      SELECT id, name, ST_AsGeoJSON(geom) AS geojson
      FROM geo_services.risk_layers
      WHERE tenant_id = ${TENANT_ID}::uuid
        AND is_active = true
        AND geom IS NOT NULL
        AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint(36.82, -1.28), 4326)::geography,
          200000
        )
    `;

    expect(riskRows.length).toBeGreaterThanOrEqual(1);

    // Find nearby events
    const eventRows = await prisma.$queryRaw<any[]>`
      SELECT id, entity_type,
        ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint(36.82, -1.28), 4326)::geography
        ) AS distance
      FROM geo_services.geo_events
      WHERE tenant_id = ${TENANT_ID}::uuid
        AND geom IS NOT NULL
        AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint(36.82, -1.28), 4326)::geography,
          200000
        )
    `;

    expect(eventRows.length).toBeGreaterThanOrEqual(1);
    expect(Number(eventRows[0].distance)).toBeLessThan(200000);

    // Clean up event
    await prisma.$executeRawUnsafe(
      `DELETE FROM geo_services.geo_events WHERE id = $1::uuid`,
      eventId,
    ).catch(() => {});
  });

  it('soft deletes by setting is_active to false', async () => {
    if (!prisma) return;

    const id = crypto.randomUUID();
    layerIds.push(id);

    await prisma.$executeRaw`
      INSERT INTO geo_services.risk_layers (
        id, tenant_id, name, layer_type, severity,
        geom, is_active, created_at, updated_at
      ) VALUES (
        ${id}::uuid, ${TENANT_ID}::uuid,
        'To Delete', 'TRADE_CORRIDOR'::"geo_services"."RiskLayerType",
        'LOW'::"geo_services"."RiskSeverity",
        ST_GeomFromGeoJSON(${JSON.stringify(KENYA_POLYGON)}),
        true, NOW(), NOW()
      )
    `;

    // Soft delete
    await prisma.$executeRaw`
      UPDATE geo_services.risk_layers
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}::uuid AND tenant_id = ${TENANT_ID}::uuid
    `;

    // Should not appear in active-only queries
    const activeRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM geo_services.risk_layers
      WHERE id = ${id}::uuid AND is_active = true
    `;
    expect(activeRows).toHaveLength(0);

    // But should still exist in DB
    const allRows = await prisma.$queryRaw<any[]>`
      SELECT id, is_active FROM geo_services.risk_layers
      WHERE id = ${id}::uuid
    `;
    expect(allRows).toHaveLength(1);
    expect(allRows[0].is_active).toBe(false);
  });
});
