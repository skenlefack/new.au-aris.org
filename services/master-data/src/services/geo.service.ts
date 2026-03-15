import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { StandaloneCacheService } from '@aris/cache';
import { DEFAULT_TTLS } from '@aris/cache';
import {
  TOPIC_SYS_MASTER_GEO_UPDATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuditService } from './audit.service';

const SERVICE_NAME = 'master-data-service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class GeoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
    private readonly cache: StandaloneCacheService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).geoEntity.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `GeoEntity with code "${dto.code}" already exists`);
    }

    if (dto.parentId) {
      const parent = await (this.prisma as any).geoEntity.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new HttpError(404, `Parent GeoEntity ${dto.parentId} not found`);
      }
    }

    const entity = await (this.prisma as any).geoEntity.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        level: dto.level,
        parentId: dto.parentId ?? null,
        countryCode: dto.countryCode,
        centroidLat: dto.centroidLat ?? null,
        centroidLng: dto.centroidLng ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'GeoEntity',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.cache.invalidateByPattern('master-data', 'geo');
    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & {
      level?: string;
      countryCode?: string;
      parentId?: string;
      search?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.level) where['level'] = query.level;
    if (query.countryCode) where['countryCode'] = query.countryCode;
    if (query.parentId) where['parentId'] = query.parentId;
    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = `aris:master-data:geo:list:${JSON.stringify({ where, skip, limit, orderBy })}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const [data, total] = await Promise.all([
        (this.prisma as any).geoEntity.findMany({ where, skip, take: limit, orderBy }),
        (this.prisma as any).geoEntity.count({ where }),
      ]);
      return { data, meta: { total, page, limit } };
    }, DEFAULT_TTLS.QUERY_RESULT);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const cacheKey = `aris:master-data:geo:${id}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const entity = await (this.prisma as any).geoEntity.findUnique({ where: { id } });
      if (!entity) throw new HttpError(404, `GeoEntity ${id} not found`);
      return { data: entity };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async findByCode(code: string): Promise<ApiResponse<any>> {
    const cacheKey = `aris:master-data:geo:code:${code}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const entity = await (this.prisma as any).geoEntity.findUnique({ where: { code } });
      if (!entity) throw new HttpError(404, `GeoEntity with code "${code}" not found`);
      return { data: entity };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).geoEntity.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `GeoEntity ${id} not found`);
    }

    const entity = await (this.prisma as any).geoEntity.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.centroidLat !== undefined && { centroidLat: dto.centroidLat }),
        ...(dto.centroidLng !== undefined && { centroidLng: dto.centroidLng }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'GeoEntity',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.cache.invalidateByPattern('master-data', 'geo');
    return { data: entity };
  }

  async findChildren(
    parentId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<any>> {
    const parent = await (this.prisma as any).geoEntity.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new HttpError(404, `GeoEntity ${parentId} not found`);
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { parentId, isActive: true };

    const cacheKey = `aris:master-data:geo:children:${parentId}:${JSON.stringify({ skip, limit })}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const [data, total] = await Promise.all([
        (this.prisma as any).geoEntity.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
        (this.prisma as any).geoEntity.count({ where }),
      ]);
      return { data, meta: { total, page, limit } };
    }, DEFAULT_TTLS.QUERY_RESULT);
  }

  private async publishEvent(
    entity: { id: string; [key: string]: unknown },
    user: AuthUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafka.send(
        TOPIC_SYS_MASTER_GEO_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish geo event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
