import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_FISHERIES_AQUACULTURE_FARM_CREATED,
  TOPIC_MS_FISHERIES_AQUACULTURE_FARM_UPDATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'fisheries-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class AquacultureFarmService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: {
      name: string;
      farmType: string;
      waterSource: string;
      areaHectares: number;
      speciesIds: string[];
      productionCapacityTonnes: number;
      geoEntityId: string;
      coordinates?: Record<string, unknown>;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const farm = await (this.prisma as any).aquacultureFarm.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        farmType: dto.farmType,
        waterSource: dto.waterSource,
        areaHectares: dto.areaHectares,
        speciesIds: dto.speciesIds,
        productionCapacityTonnes: dto.productionCapacityTonnes,
        geoEntityId: dto.geoEntityId,
        coordinates: dto.coordinates ?? {},
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_AQUACULTURE_FARM_CREATED, { id: farm.id, ...farm }, user);

    return { data: farm };
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      farmType?: string;
      waterType?: string;
    },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).aquacultureFarm.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).aquacultureFarm.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const farm = await (this.prisma as any).aquacultureFarm.findUnique({ where: { id } });

    if (!farm) {
      throw new HttpError(404, `Aquaculture farm ${id} not found`);
    }

    this.verifyTenantAccess(user, farm.tenantId);

    return { data: farm };
  }

  async update(
    id: string,
    dto: {
      name?: string;
      farmType?: string;
      waterSource?: string;
      areaHectares?: number;
      speciesIds?: string[];
      productionCapacityTonnes?: number;
      geoEntityId?: string;
      coordinates?: Record<string, unknown>;
      isActive?: boolean;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).aquacultureFarm.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, `Aquaculture farm ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const farm = await (this.prisma as any).aquacultureFarm.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.farmType !== undefined && { farmType: dto.farmType }),
        ...(dto.waterSource !== undefined && { waterSource: dto.waterSource }),
        ...(dto.areaHectares !== undefined && { areaHectares: dto.areaHectares }),
        ...(dto.speciesIds !== undefined && { speciesIds: dto.speciesIds }),
        ...(dto.productionCapacityTonnes !== undefined && { productionCapacityTonnes: dto.productionCapacityTonnes }),
        ...(dto.geoEntityId !== undefined && { geoEntityId: dto.geoEntityId }),
        ...(dto.coordinates !== undefined && { coordinates: dto.coordinates }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_AQUACULTURE_FARM_UPDATED, { id: farm.id, ...farm }, user);

    return { data: farm };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: { farmType?: string; waterType?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.farmType) where['farmType'] = query.farmType;
    if (query.waterType) where['waterSource'] = query.waterType;

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
      correlationId: uuidv4(),
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
