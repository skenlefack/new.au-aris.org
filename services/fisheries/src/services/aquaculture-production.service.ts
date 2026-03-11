import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_CREATED,
  TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_UPDATED,
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

export class AquacultureProductionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: {
      farmId: string;
      speciesId: string;
      quantityKg: number;
      harvestDate: string;
      methodOfCulture: string;
      feedUsedKg?: number;
      fcr?: number;
      batchId?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    // Verify the farm exists and belongs to this tenant
    const farm = await (this.prisma as any).aquacultureFarm.findUnique({
      where: { id: dto.farmId },
    });

    if (!farm) {
      throw new HttpError(404, `Aquaculture farm ${dto.farmId} not found`);
    }

    this.verifyTenantAccess(user, farm.tenantId);

    const production = await (this.prisma as any).aquacultureProduction.create({
      data: {
        tenantId: user.tenantId,
        farmId: dto.farmId,
        speciesId: dto.speciesId,
        quantityKg: dto.quantityKg,
        harvestDate: new Date(dto.harvestDate),
        methodOfCulture: dto.methodOfCulture,
        feedUsedKg: dto.feedUsedKg ?? null,
        fcr: dto.fcr ?? null,
        batchId: dto.batchId ?? null,
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_CREATED,
      { id: production.id, ...production },
      user,
    );

    return { data: production };
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      farmId?: string;
      speciesId?: string;
    },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).aquacultureProduction.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).aquacultureProduction.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const production = await (this.prisma as any).aquacultureProduction.findUnique({
      where: { id },
    });

    if (!production) {
      throw new HttpError(404, `Aquaculture production record ${id} not found`);
    }

    this.verifyTenantAccess(user, production.tenantId);

    return { data: production };
  }

  async update(
    id: string,
    dto: {
      farmId?: string;
      speciesId?: string;
      quantityKg?: number;
      harvestDate?: string;
      methodOfCulture?: string;
      feedUsedKg?: number;
      fcr?: number;
      batchId?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).aquacultureProduction.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Aquaculture production record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    // If updating farmId, verify the new farm exists and is accessible
    if (dto.farmId && dto.farmId !== existing.farmId) {
      const farm = await (this.prisma as any).aquacultureFarm.findUnique({
        where: { id: dto.farmId },
      });

      if (!farm) {
        throw new HttpError(404, `Aquaculture farm ${dto.farmId} not found`);
      }

      this.verifyTenantAccess(user, farm.tenantId);
    }

    const production = await (this.prisma as any).aquacultureProduction.update({
      where: { id },
      data: {
        ...(dto.farmId !== undefined && { farmId: dto.farmId }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.quantityKg !== undefined && { quantityKg: dto.quantityKg }),
        ...(dto.harvestDate !== undefined && { harvestDate: new Date(dto.harvestDate) }),
        ...(dto.methodOfCulture !== undefined && { methodOfCulture: dto.methodOfCulture }),
        ...(dto.feedUsedKg !== undefined && { feedUsedKg: dto.feedUsedKg }),
        ...(dto.fcr !== undefined && { fcr: dto.fcr }),
        ...(dto.batchId !== undefined && { batchId: dto.batchId }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_MS_FISHERIES_AQUACULTURE_PRODUCTION_UPDATED,
      { id: production.id, ...production },
      user,
    );

    return { data: production };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: { farmId?: string; speciesId?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.farmId) where['farmId'] = query.farmId;
    if (query.speciesId) where['speciesId'] = query.speciesId;

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
