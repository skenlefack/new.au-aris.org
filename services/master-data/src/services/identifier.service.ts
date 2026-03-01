import type { PrismaClient, Prisma } from '@prisma/client';
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

export class IdentifierService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).identifier.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `Identifier with code "${dto.code}" already exists`);
    }

    if (dto.geoEntityId) {
      const geoEntity = await (this.prisma as any).geoEntity.findUnique({
        where: { id: dto.geoEntityId },
      });
      if (!geoEntity) {
        throw new HttpError(404, `GeoEntity ${dto.geoEntityId} not found`);
      }
    }

    const entity = await (this.prisma as any).identifier.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        type: dto.type,
        geoEntityId: dto.geoEntityId ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        address: dto.address ?? null,
        contactInfo: (dto.contactInfo ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Identifier',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & { type?: string; geoEntityId?: string; search?: string },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.type) where['type'] = query.type;
    if (query.geoEntityId) where['geoEntityId'] = query.geoEntityId;
    if (query.search) {
      where['OR'] = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).identifier.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).identifier.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const entity = await (this.prisma as any).identifier.findUnique({ where: { id } });
    if (!entity) {
      throw new HttpError(404, `Identifier ${id} not found`);
    }
    return { data: entity };
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).identifier.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Identifier ${id} not found`);
    }

    const entity = await (this.prisma as any).identifier.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.contactInfo !== undefined && { contactInfo: dto.contactInfo as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Identifier',
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
