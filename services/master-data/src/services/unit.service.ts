import type { PrismaClient } from '@prisma/client';
import type { StandaloneCacheService } from '@aris/cache';
import { DEFAULT_TTLS } from '@aris/cache';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuditService } from './audit.service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class UnitService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly cache: StandaloneCacheService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).unit.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `Unit with code "${dto.code}" already exists`);
    }

    const entity = await (this.prisma as any).unit.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        symbol: dto.symbol,
        category: dto.category,
        siConversion: dto.siConversion ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Unit',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.cache.invalidateByPattern('master-data', 'unit');
    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & { category?: string; search?: string },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.category) where['category'] = query.category;
    if (query.search) {
      where['OR'] = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { symbol: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = `aris:master-data:unit:list:${JSON.stringify({ where, skip, limit, orderBy })}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const [data, total] = await Promise.all([
        (this.prisma as any).unit.findMany({ where, skip, take: limit, orderBy }),
        (this.prisma as any).unit.count({ where }),
      ]);
      return { data, meta: { total, page, limit } };
    }, DEFAULT_TTLS.QUERY_RESULT);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const cacheKey = `aris:master-data:unit:${id}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const entity = await (this.prisma as any).unit.findUnique({ where: { id } });
      if (!entity) throw new HttpError(404, `Unit ${id} not found`);
      return { data: entity };
    }, DEFAULT_TTLS.MASTER_DATA);
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).unit.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Unit ${id} not found`);
    }

    const entity = await (this.prisma as any).unit.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol }),
        ...(dto.siConversion !== undefined && { siConversion: dto.siConversion }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Unit',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.cache.invalidateByPattern('master-data', 'unit');
    return { data: entity };
  }
}
