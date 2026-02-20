import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';
import type { WithinQueryDto } from './dto/within-query.dto';
import type { NearestQueryDto } from './dto/nearest-query.dto';
import type { ContainsQueryDto } from './dto/contains-query.dto';
import type { RiskMapQueryDto } from './dto/risk-map-query.dto';
import type {
  MapLayerEntity,
  AdminBoundaryEntity,
  SpatialEntity,
  ContainsResult,
  RiskZoneProperties,
  GeoJsonFeatureCollection,
  GeoJsonFeature,
} from './entities/geo.entity';
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
} from './entities/geo.entity';
import type { ApiResponse } from '@aris/shared-types';

const DEFAULT_NEAREST_LIMIT = 5;
const DEFAULT_WITHIN_LIMIT = 100;
const DEFAULT_MAX_DISTANCE = 100_000; // 100 km

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── List Layers ──

  async listLayers(): Promise<ApiResponse<MapLayerEntity[]>> {
    const cacheKey = 'geo:layers';
    const cached = await this.cacheGet<MapLayerEntity[]>(cacheKey);
    if (cached) return { data: cached };

    const rows = await this.prisma.mapLayer.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    const data = rows.map((r) => this.toLayerEntity(r));

    await this.cacheSet(cacheKey, data, CACHE_TTL_LAYERS);
    return { data };
  }

  // ── Query Within (bounding box) ──

  async queryWithin(
    dto: WithinQueryDto,
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
    dto: NearestQueryDto,
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
    dto: ContainsQueryDto,
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
    dto: RiskMapQueryDto,
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

    this.logger.log(
      `Risk map generated: disease=${dto.diseaseId} period=${dto.periodStart}..${dto.periodEnd} zones=${features.length}`,
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
      throw new NotFoundException(`Admin boundary with code "${code}" not found`);
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

  // ── Entity mapping ──

  toLayerEntity(row: {
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

  // ── Cache helpers ──

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Redis cache read failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }

  private async cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), ttl);
    } catch (error) {
      this.logger.warn(
        `Redis cache write failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
