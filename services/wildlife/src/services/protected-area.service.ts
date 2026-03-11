import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_MS_WILDLIFE_PROTECTED_AREA_CREATED,
  TOPIC_MS_WILDLIFE_PROTECTED_AREA_UPDATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'wildlife-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateProtectedAreaInput {
  name: string;
  wdpaId?: string;
  iucnCategory: string;
  geoEntityId: string;
  areaKm2: number;
  designationDate?: string;
  managingAuthority: string;
  coordinates?: unknown;
  isActive?: boolean;
  dataClassification?: string;
}

export interface UpdateProtectedAreaInput {
  name?: string;
  wdpaId?: string;
  iucnCategory?: string;
  geoEntityId?: string;
  areaKm2?: number;
  designationDate?: string;
  managingAuthority?: string;
  coordinates?: unknown;
  isActive?: boolean;
  dataClassification?: string;
}

export interface ProtectedAreaFilter {
  geoEntityId?: string;
  iucnCategory?: string;
  managingAuthority?: string;
  isActive?: boolean;
}

export class ProtectedAreaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateProtectedAreaInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PUBLIC';

    const area = await (this.prisma as any).protectedArea.create({
      data: {
        name: dto.name,
        wdpaId: dto.wdpaId,
        iucnCategory: dto.iucnCategory,
        geoEntityId: dto.geoEntityId,
        areaKm2: dto.areaKm2,
        designationDate: dto.designationDate ? new Date(dto.designationDate) : undefined,
        managingAuthority: dto.managingAuthority,
        coordinates: dto.coordinates,
        isActive: dto.isActive ?? true,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_PROTECTED_AREA_CREATED, area, user);

    return { data: area };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: ProtectedAreaFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).protectedArea.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).protectedArea.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const area = await (this.prisma as any).protectedArea.findUnique({
      where: { id },
    });

    if (!area) {
      throw new HttpError(404, `Protected area ${id} not found`);
    }

    this.verifyTenantAccess(user, area.tenantId);

    return { data: area };
  }

  async update(id: string, dto: UpdateProtectedAreaInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).protectedArea.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Protected area ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.wdpaId !== undefined) updateData['wdpaId'] = dto.wdpaId;
    if (dto.iucnCategory !== undefined) updateData['iucnCategory'] = dto.iucnCategory;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.areaKm2 !== undefined) updateData['areaKm2'] = dto.areaKm2;
    if (dto.designationDate !== undefined) updateData['designationDate'] = new Date(dto.designationDate);
    if (dto.managingAuthority !== undefined) updateData['managingAuthority'] = dto.managingAuthority;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).protectedArea.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_PROTECTED_AREA_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: ProtectedAreaFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.iucnCategory) where['iucnCategory'] = filter.iucnCategory;
    if (filter.managingAuthority) where['managingAuthority'] = filter.managingAuthority;
    if (filter.isActive !== undefined) where['isActive'] = filter.isActive;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new HttpError(404, 'Resource not found');
  }

  private async publishEvent(
    topic: string,
    payload: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
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
      await this.kafka.send(topic, payload.id, payload, headers);
    } catch (error) {
      console.error(`Failed to publish ${topic}`, error);
    }
  }
}
