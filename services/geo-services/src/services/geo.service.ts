import { PrismaClient, Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import type { ApiResponse } from '@aris/shared-types';
import type {
  MapLayerEntity,
  SpatialEntity,
  ContainsResult,
  RiskZoneProperties,
  GeoJsonFeatureCollection,
  GeoJsonFeature,
  GeoJsonGeometry,
} from '../geo/entities/geo.entity';
import type { SpatialAnalysisResult, RiskLayerResponse } from '../types/risk-layer.types';
import {
  classifySeverity,
  buildFeature,
  buildFeatureCollection,
  CACHE_TTL_RISK_MAP,
  CACHE_TTL_BOUNDARY,
  CACHE_TTL_LAYERS,
  CACHE_TTL_WITHIN,
  CACHE_TTL_NEAREST,
  CACHE_TTL_CONTAINS,
} from '../geo/entities/geo.entity';

const DEFAULT_NEAREST_LIMIT = 5;
const DEFAULT_WITHIN_LIMIT = 100;
const DEFAULT_MAX_DISTANCE = 100_000; // 100 km

export interface WithinQuery {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  level?: string;
  limit?: number;
}

export interface NearestQuery {
  lat: number;
  lng: number;
  level?: string;
  maxDistance?: number;
  limit?: number;
}

export interface ContainsQuery {
  lat: number;
  lng: number;
}

export interface RiskMapQuery {
  diseaseId: string;
  periodStart: string;
  periodEnd: string;
  countryCode?: string;
  adminLevel?: 'ADMIN1' | 'ADMIN2';
}

/** Custom error with statusCode for Fastify error handler */
class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

export class GeoService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  // ── List Layers ──

  async listLayers(): Promise<ApiResponse<MapLayerEntity[]>> {
    const cacheKey = 'geo:layers';
    const cached = await this.cacheGet<MapLayerEntity[]>(cacheKey);
    if (cached) return { data: cached };

    const rows = await (this.prisma as any).mapLayer.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    const data = rows.map((r: any) => this.toLayerEntity(r));

    await this.cacheSet(cacheKey, data, CACHE_TTL_LAYERS);
    return { data };
  }

  // ── Query Within (bounding box) ──

  async queryWithin(
    dto: WithinQuery,
  ): Promise<ApiResponse<GeoJsonFeatureCollection>> {
    const limit = dto.limit ?? DEFAULT_WITHIN_LIMIT;
    const cacheKey = `geo:within:${dto.minLng}:${dto.minLat}:${dto.maxLng}:${dto.maxLat}:${dto.level ?? 'all'}:${limit}`;

    const cached = await this.cacheGet<GeoJsonFeatureCollection>(cacheKey);
    if (cached) return { data: cached };

    const levelFilter = dto.level
      ? Prisma.sql`AND ab.level = ${dto.level}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SpatialEntity[]>`
      SELECT
        ab.id,
        ab.code,
        ab.name,
        ab.level,
        ab.country_code AS "countryCode",
        ab.centroid_lat  AS "centroidLat",
        ab.centroid_lng  AS "centroidLng",
        ST_AsGeoJSON(ab.geom) AS geojson
      FROM geo_services.admin_boundaries ab
      WHERE ab.geom IS NOT NULL
        AND ST_Intersects(
          ab.geom,
          ST_MakeEnvelope(${dto.minLng}, ${dto.minLat}, ${dto.maxLng}, ${dto.maxLat}, 4326)
        )
        ${levelFilter}
      LIMIT ${limit}
    `;

    const features: GeoJsonFeature[] = rows.map((r) =>
      buildFeature(r.geojson, {
        id: r.id,
        code: r.code,
        name: r.name,
        level: r.level,
        countryCode: r.countryCode,
      }),
    );

    const data = buildFeatureCollection(features);
    await this.cacheSet(cacheKey, data, CACHE_TTL_WITHIN);
    return { data };
  }

  // ── Query Nearest ──

  async queryNearest(
    dto: NearestQuery,
  ): Promise<ApiResponse<GeoJsonFeatureCollection>> {
    const limit = dto.limit ?? DEFAULT_NEAREST_LIMIT;
    const maxDistance = dto.maxDistance ?? DEFAULT_MAX_DISTANCE;
    const cacheKey = `geo:nearest:${dto.lat}:${dto.lng}:${dto.level ?? 'all'}:${maxDistance}:${limit}`;

    const cached = await this.cacheGet<GeoJsonFeatureCollection>(cacheKey);
    if (cached) return { data: cached };

    const levelFilter = dto.level
      ? Prisma.sql`AND ab.level = ${dto.level}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<(SpatialEntity & { distance: number })[]>`
      SELECT
        ab.id,
        ab.code,
        ab.name,
        ab.level,
        ab.country_code AS "countryCode",
        ab.centroid_lat  AS "centroidLat",
        ab.centroid_lng  AS "centroidLng",
        ST_AsGeoJSON(ab.geom) AS geojson,
        ST_Distance(
          ab.geom::geography,
          ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
        ) AS distance
      FROM geo_services.admin_boundaries ab
      WHERE ab.geom IS NOT NULL
        AND ST_DWithin(
          ab.geom::geography,
          ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography,
          ${maxDistance}
        )
        ${levelFilter}
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    const features: GeoJsonFeature[] = rows.map((r) =>
      buildFeature(r.geojson, {
        id: r.id,
        code: r.code,
        name: r.name,
        level: r.level,
        countryCode: r.countryCode,
        distance: Math.round(r.distance),
      }),
    );

    const data = buildFeatureCollection(features);
    await this.cacheSet(cacheKey, data, CACHE_TTL_NEAREST);
    return { data };
  }

  // ── Query Contains (reverse geocode) ──

  async queryContains(
    dto: ContainsQuery,
  ): Promise<ApiResponse<ContainsResult[]>> {
    const cacheKey = `geo:contains:${dto.lat}:${dto.lng}`;

    const cached = await this.cacheGet<ContainsResult[]>(cacheKey);
    if (cached) return { data: cached };

    const rows = await this.prisma.$queryRaw<ContainsResult[]>`
      SELECT
        ab.code,
        ab.name,
        ab.level,
        ab.country_code AS "countryCode"
      FROM geo_services.admin_boundaries ab
      WHERE ab.geom IS NOT NULL
        AND ST_Contains(
          ab.geom,
          ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)
        )
      ORDER BY
        CASE ab.level
          WHEN 'ADMIN3' THEN 1
          WHEN 'ADMIN2' THEN 2
          WHEN 'ADMIN1' THEN 3
          WHEN 'COUNTRY' THEN 4
          ELSE 5
        END
    `;

    await this.cacheSet(cacheKey, rows, CACHE_TTL_CONTAINS);
    return { data: rows };
  }

  // ── Risk Map ──

  async getRiskMap(
    dto: RiskMapQuery,
  ): Promise<ApiResponse<GeoJsonFeatureCollection<RiskZoneProperties>>> {
    const adminLevel = dto.adminLevel ?? 'ADMIN2';
    const cacheKey = `geo:risk:${dto.diseaseId}:${dto.periodStart}:${dto.periodEnd}:${dto.countryCode ?? 'all'}:${adminLevel}`;

    const cached = await this.cacheGet<GeoJsonFeatureCollection<RiskZoneProperties>>(cacheKey);
    if (cached) return { data: cached };

    const countryFilter = dto.countryCode
      ? Prisma.sql`AND ab.country_code = ${dto.countryCode}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      { code: string; name: string; country_code: string; event_count: bigint; geojson: string }[]
    >`
      SELECT
        ab.code,
        ab.name,
        ab.country_code,
        COALESCE(ev.event_count, 0) AS event_count,
        ST_AsGeoJSON(ab.geom) AS geojson
      FROM geo_services.admin_boundaries ab
      LEFT JOIN (
        SELECT
          ab2.code AS boundary_code,
          COUNT(ge.id) AS event_count
        FROM geo_services.geo_events ge
        JOIN geo_services.admin_boundaries ab2
          ON ab2.level = ${adminLevel}
          AND ab2.geom IS NOT NULL
          AND ST_Contains(ab2.geom, ge.geom)
        WHERE ge.disease_id = ${dto.diseaseId}::uuid
          AND ge.occurred_at >= ${dto.periodStart}::timestamptz
          AND ge.occurred_at <= ${dto.periodEnd}::timestamptz
        GROUP BY ab2.code
      ) ev ON ev.boundary_code = ab.code
      WHERE ab.level = ${adminLevel}
        AND ab.geom IS NOT NULL
        ${countryFilter}
      ORDER BY ab.code
    `;

    const features = rows
      .filter((r) => r.geojson !== null)
      .map((r) => {
        const eventCount = Number(r.event_count);
        return buildFeature<RiskZoneProperties>(r.geojson, {
          code: r.code,
          name: r.name,
          countryCode: r.country_code,
          eventCount,
          severity: classifySeverity(eventCount),
        });
      });

    const data = buildFeatureCollection(features);
    await this.cacheSet(cacheKey, data, CACHE_TTL_RISK_MAP);

    console.log(
      `[GeoService] Risk map generated: disease=${dto.diseaseId} period=${dto.periodStart}..${dto.periodEnd} zones=${features.length}`,
    );
    return { data };
  }

  // ── Admin Boundary by code ──

  async getAdminBoundary(
    code: string,
  ): Promise<ApiResponse<GeoJsonFeature>> {
    const cacheKey = `geo:boundary:${code}`;

    const cached = await this.cacheGet<GeoJsonFeature>(cacheKey);
    if (cached) return { data: cached };

    const rows = await this.prisma.$queryRaw<
      { id: string; code: string; name: string; name_en: string; name_fr: string; level: string; parent_code: string | null; country_code: string; centroid_lat: number | null; centroid_lng: number | null; geojson: string }[]
    >`
      SELECT
        ab.id,
        ab.code,
        ab.name,
        ab.name_en,
        ab.name_fr,
        ab.level,
        ab.parent_code,
        ab.country_code,
        ab.centroid_lat,
        ab.centroid_lng,
        ST_AsGeoJSON(ab.geom) AS geojson
      FROM geo_services.admin_boundaries ab
      WHERE ab.code = ${code}
    `;

    if (rows.length === 0) {
      throw new HttpError(404, `Admin boundary with code "${code}" not found`);
    }

    const row = rows[0];
    const feature = buildFeature(row.geojson ?? '{"type":"MultiPolygon","coordinates":[]}', {
      id: row.id,
      code: row.code,
      name: row.name,
      nameEn: row.name_en,
      nameFr: row.name_fr,
      level: row.level,
      parentCode: row.parent_code,
      countryCode: row.country_code,
      centroidLat: row.centroid_lat,
      centroidLng: row.centroid_lng,
    });

    await this.cacheSet(cacheKey, feature, CACHE_TTL_BOUNDARY);
    return { data: feature };
  }

  // ── Spatial Analysis ──

  async spatialAnalysis(params: {
    point: { lat: number; lng: number };
    radiusKm: number;
    tenantId: string;
    layerTypes?: string[];
  }): Promise<ApiResponse<SpatialAnalysisResult>> {
    const radiusMeters = params.radiusKm * 1000;

    const layerTypeFilter = params.layerTypes && params.layerTypes.length > 0
      ? Prisma.sql`AND layer_type::text = ANY(${params.layerTypes})`
      : Prisma.empty;

    // Find intersecting risk layers within the radius
    const riskRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        name: string;
        description: string | null;
        layer_type: string;
        severity: string;
        geojson: string | null;
        properties: unknown;
        data_classification: string;
        valid_from: Date | null;
        valid_until: Date | null;
        source: string | null;
        is_active: boolean;
        created_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        id, tenant_id, name, description, layer_type, severity,
        ST_AsGeoJSON(geom) AS geojson,
        properties, data_classification, valid_from, valid_until,
        source, is_active, created_by, created_at, updated_at
      FROM geo_services.risk_layers
      WHERE tenant_id = ${params.tenantId}::uuid
        AND is_active = true
        AND geom IS NOT NULL
        AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint(${params.point.lng}, ${params.point.lat}), 4326)::geography,
          ${radiusMeters}
        )
        ${layerTypeFilter}
      ORDER BY severity DESC
      LIMIT 50
    `;

    const riskLayers: RiskLayerResponse[] = riskRows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      description: r.description,
      layerType: r.layer_type as RiskLayerResponse['layerType'],
      severity: r.severity as RiskLayerResponse['severity'],
      geometry: r.geojson ? (JSON.parse(r.geojson) as GeoJsonGeometry) : null,
      properties: (r.properties ?? {}) as Record<string, unknown>,
      dataClassification: r.data_classification,
      validFrom: r.valid_from?.toISOString() ?? null,
      validUntil: r.valid_until?.toISOString() ?? null,
      source: r.source,
      isActive: r.is_active,
      createdBy: r.created_by,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));

    // Find nearby geo events
    const eventRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        latitude: number;
        longitude: number;
        occurred_at: Date;
        properties: unknown;
        distance: number;
      }>
    >`
      SELECT
        ge.id,
        ge.entity_type,
        ge.entity_id,
        ge.latitude,
        ge.longitude,
        ge.occurred_at,
        ge.properties,
        ST_Distance(
          ge.geom::geography,
          ST_SetSRID(ST_MakePoint(${params.point.lng}, ${params.point.lat}), 4326)::geography
        ) AS distance
      FROM geo_services.geo_events ge
      WHERE ge.tenant_id = ${params.tenantId}::uuid
        AND ge.geom IS NOT NULL
        AND ST_DWithin(
          ge.geom::geography,
          ST_SetSRID(ST_MakePoint(${params.point.lng}, ${params.point.lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY distance ASC
      LIMIT 100
    `;

    const nearbyEvents = eventRows.map((e) => ({
      id: e.id,
      entityType: e.entity_type,
      entityId: e.entity_id,
      latitude: e.latitude,
      longitude: e.longitude,
      occurredAt: e.occurred_at.toISOString(),
      properties: (e.properties ?? {}) as Record<string, unknown>,
      distanceMeters: Math.round(e.distance),
    }));

    // Generate buffer zone GeoJSON
    const bufferRows = await this.prisma.$queryRaw<{ geojson: string }[]>`
      SELECT ST_AsGeoJSON(
        ST_Buffer(
          ST_SetSRID(ST_MakePoint(${params.point.lng}, ${params.point.lat}), 4326)::geography,
          ${radiusMeters}
        )::geometry
      ) AS geojson
    `;

    const bufferZone: GeoJsonGeometry = bufferRows.length > 0
      ? JSON.parse(bufferRows[0].geojson)
      : { type: 'Polygon', coordinates: [] };

    return {
      data: {
        riskLayers,
        nearbyEvents,
        bufferZone,
      },
    };
  }

  // ── Entity mapping ──

  private toLayerEntity(row: {
    id: string;
    name: string;
    description: string | null;
    layer_type: string;
    source_table: string;
    geometry_type: string;
    style: unknown;
    min_zoom: number;
    max_zoom: number;
    is_active: boolean;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }): MapLayerEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      layerType: row.layer_type as MapLayerEntity['layerType'],
      sourceTable: row.source_table,
      geometryType: row.geometry_type,
      style: row.style,
      minZoom: row.min_zoom,
      maxZoom: row.max_zoom,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Cache helpers (using ioredis directly) ──

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(
        `[GeoService] Redis cache read failed for ${key}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }

  private async cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      console.warn(
        `[GeoService] Redis cache write failed for ${key}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
