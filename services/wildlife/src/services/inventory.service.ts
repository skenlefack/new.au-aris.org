import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_MS_WILDLIFE_INVENTORY_CREATED,
  TOPIC_MS_WILDLIFE_INVENTORY_UPDATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'wildlife-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateInventoryInput {
  speciesId: string;
  geoEntityId: string;
  protectedAreaId?: string;
  surveyDate: string;
  populationEstimate: number;
  methodology: string;
  confidenceInterval?: string;
  conservationStatus: string;
  threatLevel: string;
  coordinates?: unknown;
  dataClassification?: string;
}

export interface UpdateInventoryInput {
  speciesId?: string;
  geoEntityId?: string;
  protectedAreaId?: string;
  surveyDate?: string;
  populationEstimate?: number;
  methodology?: string;
  confidenceInterval?: string;
  conservationStatus?: string;
  threatLevel?: string;
  coordinates?: unknown;
  dataClassification?: string;
}

export interface InventoryFilter {
  speciesId?: string;
  geoEntityId?: string;
  protectedAreaId?: string;
  conservationStatus?: string;
  threatLevel?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class InventoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateInventoryInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'RESTRICTED';

    const inventory = await (this.prisma as any).wildlifeInventory.create({
      data: {
        speciesId: dto.speciesId,
        geoEntityId: dto.geoEntityId,
        protectedAreaId: dto.protectedAreaId,
        surveyDate: new Date(dto.surveyDate),
        populationEstimate: dto.populationEstimate,
        methodology: dto.methodology,
        confidenceInterval: dto.confidenceInterval,
        conservationStatus: dto.conservationStatus,
        threatLevel: dto.threatLevel,
        coordinates: dto.coordinates,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_INVENTORY_CREATED, inventory, user);

    return { data: inventory };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: InventoryFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).wildlifeInventory.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).wildlifeInventory.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const inventory = await (this.prisma as any).wildlifeInventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new HttpError(404, `Wildlife inventory ${id} not found`);
    }

    this.verifyTenantAccess(user, inventory.tenantId);

    return { data: inventory };
  }

  async update(id: string, dto: UpdateInventoryInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).wildlifeInventory.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Wildlife inventory ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.protectedAreaId !== undefined) updateData['protectedAreaId'] = dto.protectedAreaId;
    if (dto.surveyDate !== undefined) updateData['surveyDate'] = new Date(dto.surveyDate);
    if (dto.populationEstimate !== undefined) updateData['populationEstimate'] = dto.populationEstimate;
    if (dto.methodology !== undefined) updateData['methodology'] = dto.methodology;
    if (dto.confidenceInterval !== undefined) updateData['confidenceInterval'] = dto.confidenceInterval;
    if (dto.conservationStatus !== undefined) updateData['conservationStatus'] = dto.conservationStatus;
    if (dto.threatLevel !== undefined) updateData['threatLevel'] = dto.threatLevel;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).wildlifeInventory.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_INVENTORY_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: InventoryFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.protectedAreaId) where['protectedAreaId'] = filter.protectedAreaId;
    if (filter.conservationStatus) where['conservationStatus'] = filter.conservationStatus;
    if (filter.threatLevel) where['threatLevel'] = filter.threatLevel;
    if (filter.periodStart || filter.periodEnd) {
      where['surveyDate'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

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
