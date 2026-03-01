import type { PrismaClient } from '@prisma/client';
import type { PaginationQuery, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { AuditService } from './audit.service';

const VALID_TYPES = [
  'geo_entities', 'species', 'diseases', 'units',
  'temporalities', 'identifiers', 'denominators',
] as const;

type ReferentialType = typeof VALID_TYPES[number];

const TYPE_TO_ENTITY: Record<ReferentialType, string> = {
  geo_entities: 'GeoEntity',
  species: 'Species',
  diseases: 'Disease',
  units: 'Unit',
  temporalities: 'Temporality',
  identifiers: 'Identifier',
  denominators: 'Denominator',
};

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class HistoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async getHistory(
    type: string,
    id: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<unknown>> {
    if (!VALID_TYPES.includes(type as ReferentialType)) {
      throw new HttpError(
        400,
        `Invalid referential type: "${type}". Must be one of: ${VALID_TYPES.join(', ')}`,
      );
    }

    const entityType = TYPE_TO_ENTITY[type as ReferentialType];

    // Verify entity exists
    const exists = await this.entityExists(type as ReferentialType, id);
    if (!exists) {
      throw new HttpError(404, `${entityType} with id "${id}" not found`);
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { entityType, entityId: id };

    const [data, total] = await Promise.all([
      (this.prisma as any).masterDataAudit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).masterDataAudit.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async softDelete(
    type: string,
    id: string,
    user: AuthUser,
    reason?: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    if (!VALID_TYPES.includes(type as ReferentialType)) {
      throw new HttpError(
        400,
        `Invalid referential type: "${type}". Must be one of: ${VALID_TYPES.join(', ')}`,
      );
    }

    const entityType = TYPE_TO_ENTITY[type as ReferentialType];
    const entity = await this.findEntity(type as ReferentialType, id);

    if (!entity) {
      throw new HttpError(404, `${entityType} with id "${id}" not found`);
    }

    await this.setInactive(type as ReferentialType, id);

    await this.audit.log({
      entityType,
      entityId: id,
      action: 'DELETE',
      user,
      reason: reason ?? 'Soft delete',
      previousVersion: entity as object,
      dataClassification: 'PUBLIC',
    });

    return { data: { deleted: true } };
  }

  private async entityExists(type: ReferentialType, id: string): Promise<boolean> {
    const entity = await this.findEntity(type, id);
    return entity !== null;
  }

  private async findEntity(type: ReferentialType, id: string): Promise<unknown> {
    switch (type) {
      case 'geo_entities':
        return (this.prisma as any).geoEntity.findUnique({ where: { id } });
      case 'species':
        return (this.prisma as any).species.findUnique({ where: { id } });
      case 'diseases':
        return (this.prisma as any).disease.findUnique({ where: { id } });
      case 'units':
        return (this.prisma as any).unit.findUnique({ where: { id } });
      case 'temporalities':
        return (this.prisma as any).temporality.findUnique({ where: { id } });
      case 'identifiers':
        return (this.prisma as any).identifier.findUnique({ where: { id } });
      case 'denominators':
        return (this.prisma as any).denominator.findUnique({ where: { id } });
    }
  }

  private async setInactive(type: ReferentialType, id: string): Promise<void> {
    const data = { isActive: false, version: { increment: 1 } };
    switch (type) {
      case 'geo_entities':
        await (this.prisma as any).geoEntity.update({ where: { id }, data });
        break;
      case 'species':
        await (this.prisma as any).species.update({ where: { id }, data });
        break;
      case 'diseases':
        await (this.prisma as any).disease.update({ where: { id }, data });
        break;
      case 'units':
        await (this.prisma as any).unit.update({ where: { id }, data });
        break;
      case 'temporalities':
        await (this.prisma as any).temporality.update({ where: { id }, data });
        break;
      case 'identifiers':
        await (this.prisma as any).identifier.update({ where: { id }, data });
        break;
      case 'denominators':
        await (this.prisma as any).denominator.update({ where: { id }, data });
        break;
    }
  }
}
