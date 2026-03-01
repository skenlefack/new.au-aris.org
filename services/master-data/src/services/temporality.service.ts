import type { PrismaClient } from '@prisma/client';
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

export class TemporalityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).temporality.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `Temporality with code "${dto.code}" already exists`);
    }

    const entity = await (this.prisma as any).temporality.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        calendarType: dto.calendarType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        year: dto.year,
        weekNumber: dto.weekNumber ?? null,
        monthNumber: dto.monthNumber ?? null,
        quarterNumber: dto.quarterNumber ?? null,
        countryCode: dto.countryCode ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Temporality',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & { calendarType?: string; year?: number; countryCode?: string },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { periodStart: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.calendarType) where['calendarType'] = query.calendarType;
    if (query.year) where['year'] = query.year;
    if (query.countryCode) where['countryCode'] = query.countryCode;

    const [data, total] = await Promise.all([
      (this.prisma as any).temporality.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).temporality.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const entity = await (this.prisma as any).temporality.findUnique({ where: { id } });
    if (!entity) {
      throw new HttpError(404, `Temporality ${id} not found`);
    }
    return { data: entity };
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).temporality.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Temporality ${id} not found`);
    }

    const entity = await (this.prisma as any).temporality.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.periodStart !== undefined && { periodStart: new Date(dto.periodStart) }),
        ...(dto.periodEnd !== undefined && { periodEnd: new Date(dto.periodEnd) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Temporality',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    return { data: entity };
  }
}
