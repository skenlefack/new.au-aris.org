import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { StandaloneCacheService } from '@aris/cache';
import { DEFAULT_TTLS } from '@aris/cache';
import {
  TOPIC_SYS_MASTER_FISHERY_REF_UPDATED,
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
import type { AuditService } from './audit.service.js';

const SERVICE_NAME = 'master-data-service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class FisheryRefService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
    private readonly cache: StandaloneCacheService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    // Check unique constraint (category + code)
    const existing = await (this.prisma as any).fisheryReferential.findUnique({
      where: { category_code: { category: dto.category, code: dto.code } },
    });
    if (existing) {
      throw new HttpError(409, `Fishery referential with category "${dto.category}" and code "${dto.code}" already exists`);
    }

    const entity = await (this.prisma as any).fisheryReferential.create({
      data: {
        tenantId: dto.tenantId ?? null,
        category: dto.category,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        faoCode: dto.faoCode ?? null,
        parentCode: dto.parentCode ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata ?? {},
      },
    });

    await this.audit.log({
      entityType: 'FisheryReferential',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.invalidateCache(dto.category);
    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & { category?: string; search?: string; isActive?: boolean },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { sortOrder: 'asc' as const };

    const where: Record<string, unknown> = {};

    // Default to active-only unless explicitly set to false
    if (query.isActive !== undefined) {
      where['isActive'] = query.isActive;
    } else {
      where['isActive'] = true;
    }

    if (query.category) where['category'] = query.category;
    if (query.search) {
      where['OR'] = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { path: ['en'], string_contains: query.search } },
        { name: { path: ['fr'], string_contains: query.search } },
      ];
    }

    // Use category-specific cache key when filtering by category
    const cacheKey = `aris:master:fishery-ref:list:${JSON.stringify({ where, skip, limit, orderBy })}`;
    const ttl = query.category ? 3600 : DEFAULT_TTLS.QUERY_RESULT;

    return this.cache.getOrSet(cacheKey, async () => {
      const [data, total] = await Promise.all([
        (this.prisma as any).fisheryReferential.findMany({ where, skip, take: limit, orderBy }),
        (this.prisma as any).fisheryReferential.count({ where }),
      ]);
      return { data, meta: { total, page, limit } };
    }, ttl);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const cacheKey = `aris:master:fishery-ref:${id}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const entity = await (this.prisma as any).fisheryReferential.findUnique({ where: { id } });
      if (!entity) throw new HttpError(404, `Fishery referential ${id} not found`);
      return { data: entity };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).fisheryReferential.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Fishery referential ${id} not found`);
    }

    const entity = await (this.prisma as any).fisheryReferential.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.faoCode !== undefined && { faoCode: dto.faoCode }),
        ...(dto.parentCode !== undefined && { parentCode: dto.parentCode }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
      },
    });

    await this.audit.log({
      entityType: 'FisheryReferential',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.invalidateCache(existing.category);
    return { data: entity };
  }

  async delete(id: string, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).fisheryReferential.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Fishery referential ${id} not found`);
    }

    // Soft delete — set isActive to false
    const entity = await (this.prisma as any).fisheryReferential.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      entityType: 'FisheryReferential',
      entityId: entity.id,
      action: 'DELETE',
      user,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    await this.invalidateCache(existing.category);
    return { data: entity };
  }

  private async invalidateCache(category?: string): Promise<void> {
    // Invalidate all fishery-ref caches (list + individual items)
    await this.cache.invalidateByPattern('master', 'fishery-ref');
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
        TOPIC_SYS_MASTER_FISHERY_REF_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish fishery-ref event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
