import { PrismaClient, Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TOPIC_MS_GEO_RISK_LAYER_CREATED,
  TOPIC_MS_GEO_RISK_LAYER_UPDATED,
  TOPIC_MS_GEO_RISK_LAYER_DELETED,
} from '@aris/shared-types';
import type {
  RiskLayerInput,
  RiskLayerUpdate,
  RiskLayerResponse,
  BboxQuery,
  RiskLayerFilters,
} from '../types/risk-layer.types';
import type { GeoJsonGeometry } from '../geo/entities/geo.entity';

const CACHE_TTL_RISK_LAYER = 300;   // 5 minutes
const CACHE_TTL_BBOX = 120;         // 2 minutes
const CACHE_PREFIX = 'aris:geo:risk-layer:';
const CACHE_BBOX_PREFIX = 'aris:geo:risk-layers:bbox:';

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

interface RawRiskLayerRow {
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
}

export class RiskLayerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafkaProducer: StandaloneKafkaProducer | null,
  ) {}

  async create(
    input: RiskLayerInput,
    tenantId: string,
    userId?: string,
  ): Promise<RiskLayerResponse> {
    const id = crypto.randomUUID();
    const geojson = JSON.stringify(input.geometry);

    await this.prisma.$executeRaw`
      INSERT INTO geo_services.risk_layers (
        id, tenant_id, name, description, layer_type, severity,
        geom, properties, data_classification,
        valid_from, valid_until, source, is_active, created_by,
        created_at, updated_at
      ) VALUES (
        ${id}::uuid,
        ${tenantId}::uuid,
        ${input.name},
        ${input.description ?? null},
        ${input.layerType}::"geo_services"."RiskLayerType",
        ${input.severity}::"geo_services"."RiskSeverity",
        ST_GeomFromGeoJSON(${geojson}),
        ${JSON.stringify(input.properties ?? {})}::jsonb,
        ${input.dataClassification ?? 'PUBLIC'},
        ${input.validFrom ? new Date(input.validFrom) : null}::timestamptz,
        ${input.validUntil ? new Date(input.validUntil) : null}::timestamptz,
        ${input.source ?? null},
        true,
        ${userId ?? null}::uuid,
        NOW(),
        NOW()
      )
    `;

    const layer = await this.findById(id, tenantId);
    await this.invalidateCache();
    await this.publishEvent(TOPIC_MS_GEO_RISK_LAYER_CREATED, layer, tenantId, userId);
    return layer;
  }

  async findById(id: string, tenantId: string): Promise<RiskLayerResponse> {
    const cacheKey = `${CACHE_PREFIX}${id}`;
    const cached = await this.cacheGet<RiskLayerResponse>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<RawRiskLayerRow[]>`
      SELECT
        id, tenant_id, name, description, layer_type, severity,
        ST_AsGeoJSON(geom) AS geojson,
        properties, data_classification, valid_from, valid_until,
        source, is_active, created_by, created_at, updated_at
      FROM geo_services.risk_layers
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
    `;

    if (rows.length === 0) {
      throw new HttpError(404, `Risk layer "${id}" not found`);
    }

    const result = this.toResponse(rows[0]);
    await this.cacheSet(cacheKey, result, CACHE_TTL_RISK_LAYER);
    return result;
  }

  async findAll(
    tenantId: string,
    filters?: RiskLayerFilters,
  ): Promise<{ data: RiskLayerResponse[]; meta: { total: number; page: number; limit: number } }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`tenant_id = ${tenantId}::uuid`,
    ];

    if (filters?.layerType) {
      conditions.push(Prisma.sql`layer_type = ${filters.layerType}::"geo_services"."RiskLayerType"`);
    }
    if (filters?.severity) {
      conditions.push(Prisma.sql`severity = ${filters.severity}::"geo_services"."RiskSeverity"`);
    }
    if (filters?.isActive !== undefined) {
      conditions.push(Prisma.sql`is_active = ${filters.isActive}`);
    }

    const where = Prisma.join(conditions, ' AND ');

    const countResult = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM geo_services.risk_layers WHERE ${where}
    `;
    const total = Number(countResult[0].count);

    const rows = await this.prisma.$queryRaw<RawRiskLayerRow[]>`
      SELECT
        id, tenant_id, name, description, layer_type, severity,
        ST_AsGeoJSON(geom) AS geojson,
        properties, data_classification, valid_from, valid_until,
        source, is_active, created_by, created_at, updated_at
      FROM geo_services.risk_layers
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return {
      data: rows.map((r) => this.toResponse(r)),
      meta: { total, page, limit },
    };
  }

  async findByBbox(
    bbox: BboxQuery,
    tenantId: string,
  ): Promise<RiskLayerResponse[]> {
    const cacheKey = `${CACHE_BBOX_PREFIX}${tenantId}:${bbox.west}:${bbox.south}:${bbox.east}:${bbox.north}:${bbox.layerType ?? 'all'}:${bbox.severity ?? 'all'}`;
    const cached = await this.cacheGet<RiskLayerResponse[]>(cacheKey);
    if (cached) return cached;

    const extraFilters: Prisma.Sql[] = [];
    if (bbox.layerType) {
      extraFilters.push(Prisma.sql`AND layer_type = ${bbox.layerType}::"geo_services"."RiskLayerType"`);
    }
    if (bbox.severity) {
      extraFilters.push(Prisma.sql`AND severity = ${bbox.severity}::"geo_services"."RiskSeverity"`);
    }

    const extraSql = extraFilters.length > 0
      ? Prisma.join(extraFilters, ' ')
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<RawRiskLayerRow[]>`
      SELECT
        id, tenant_id, name, description, layer_type, severity,
        ST_AsGeoJSON(geom) AS geojson,
        properties, data_classification, valid_from, valid_until,
        source, is_active, created_by, created_at, updated_at
      FROM geo_services.risk_layers
      WHERE tenant_id = ${tenantId}::uuid
        AND is_active = true
        AND geom IS NOT NULL
        AND ST_Intersects(
          geom,
          ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)
        )
        ${extraSql}
      ORDER BY severity DESC, created_at DESC
      LIMIT 200
    `;

    const result = rows.map((r) => this.toResponse(r));
    await this.cacheSet(cacheKey, result, CACHE_TTL_BBOX);
    return result;
  }

  async update(
    id: string,
    input: RiskLayerUpdate,
    tenantId: string,
    userId?: string,
  ): Promise<RiskLayerResponse> {
    // Verify existence and tenant ownership
    await this.findById(id, tenantId);

    const setClauses: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`];

    if (input.name !== undefined) {
      setClauses.push(Prisma.sql`name = ${input.name}`);
    }
    if (input.description !== undefined) {
      setClauses.push(Prisma.sql`description = ${input.description}`);
    }
    if (input.layerType !== undefined) {
      setClauses.push(Prisma.sql`layer_type = ${input.layerType}::"geo_services"."RiskLayerType"`);
    }
    if (input.severity !== undefined) {
      setClauses.push(Prisma.sql`severity = ${input.severity}::"geo_services"."RiskSeverity"`);
    }
    if (input.geometry !== undefined) {
      const geojson = JSON.stringify(input.geometry);
      setClauses.push(Prisma.sql`geom = ST_GeomFromGeoJSON(${geojson})`);
    }
    if (input.properties !== undefined) {
      setClauses.push(Prisma.sql`properties = ${JSON.stringify(input.properties)}::jsonb`);
    }
    if (input.dataClassification !== undefined) {
      setClauses.push(Prisma.sql`data_classification = ${input.dataClassification}`);
    }
    if (input.validFrom !== undefined) {
      setClauses.push(
        input.validFrom === null
          ? Prisma.sql`valid_from = NULL`
          : Prisma.sql`valid_from = ${new Date(input.validFrom)}::timestamptz`,
      );
    }
    if (input.validUntil !== undefined) {
      setClauses.push(
        input.validUntil === null
          ? Prisma.sql`valid_until = NULL`
          : Prisma.sql`valid_until = ${new Date(input.validUntil)}::timestamptz`,
      );
    }
    if (input.source !== undefined) {
      setClauses.push(Prisma.sql`source = ${input.source}`);
    }
    if (input.isActive !== undefined) {
      setClauses.push(Prisma.sql`is_active = ${input.isActive}`);
    }

    const setClause = Prisma.join(setClauses, ', ');

    await this.prisma.$executeRaw`
      UPDATE geo_services.risk_layers
      SET ${setClause}
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
    `;

    await this.invalidateCache(id);
    const updated = await this.findById(id, tenantId);
    await this.publishEvent(TOPIC_MS_GEO_RISK_LAYER_UPDATED, updated, tenantId, userId);
    return updated;
  }

  async delete(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const layer = await this.findById(id, tenantId);

    // Soft delete
    await this.prisma.$executeRaw`
      UPDATE geo_services.risk_layers
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
    `;

    await this.invalidateCache(id);
    await this.publishEvent(TOPIC_MS_GEO_RISK_LAYER_DELETED, layer, tenantId, userId);
  }

  // ── Helpers ──

  private toResponse(row: RawRiskLayerRow): RiskLayerResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      layerType: row.layer_type as RiskLayerResponse['layerType'],
      severity: row.severity as RiskLayerResponse['severity'],
      geometry: row.geojson ? (JSON.parse(row.geojson) as GeoJsonGeometry) : null,
      properties: (row.properties ?? {}) as Record<string, unknown>,
      dataClassification: row.data_classification,
      validFrom: row.valid_from?.toISOString() ?? null,
      validUntil: row.valid_until?.toISOString() ?? null,
      source: row.source,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private async invalidateCache(id?: string): Promise<void> {
    try {
      if (id) {
        await this.redis.del(`${CACHE_PREFIX}${id}`);
      }
      // Invalidate bbox caches
      const bboxKeys = await this.redis.keys(`${CACHE_BBOX_PREFIX}*`);
      if (bboxKeys.length > 0) {
        await this.redis.del(...bboxKeys);
      }
    } catch (error) {
      console.warn(
        '[RiskLayerService] Cache invalidation failed:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async publishEvent(
    topic: string,
    layer: RiskLayerResponse,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    if (!this.kafkaProducer) return;
    try {
      await this.kafkaProducer.send(topic, layer.id, layer, {
        correlationId: crypto.randomUUID(),
        sourceService: 'geo-services',
        tenantId,
        userId: userId ?? 'system',
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[RiskLayerService] Failed to publish ${topic}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(
        `[RiskLayerService] Redis cache read failed for ${key}:`,
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
        `[RiskLayerService] Redis cache write failed for ${key}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
