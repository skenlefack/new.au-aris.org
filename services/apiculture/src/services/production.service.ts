import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { AuditService } from './audit.service';
import type {
  CreateProductionInput,
  UpdateProductionInput,
  ProductionFilterInput,
} from '../schemas/production.schema';
import {
  TOPIC_MS_APICULTURE_PRODUCTION_RECORDED,
  TOPIC_MS_APICULTURE_PRODUCTION_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ProductionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateProductionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const classification = dto.dataClassification ?? 'PARTNER';

    const production = await (this.prisma as any).honeyProduction.create({
      data: {
        apiaryId: dto.apiaryId,
        harvestDate: dto.harvestDate,
        quantity: dto.quantity,
        unit: dto.unit,
        quality: dto.quality,
        floralSource: dto.floralSource,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('HoneyProduction', production.id, 'CREATE', user, classification as any, {
      newVersion: production as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_PRODUCTION_RECORDED, production, user);

    console.log(`[ProductionService] Honey production recorded: ${production.id} (apiary=${dto.apiaryId})`);
    return { data: production };
  }

  async findAll(
    user: AuthenticatedUser,
    query: ProductionFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).honeyProduction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).honeyProduction.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const production = await (this.prisma as any).honeyProduction.findUnique({
      where: { id },
    });

    if (!production) {
      throw new HttpError(404, `Honey production record ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      production.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Honey production record ${id} not found`);
    }

    return { data: production };
  }

  async update(
    id: string,
    dto: UpdateProductionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).honeyProduction.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Honey production record ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Honey production record ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.apiaryId !== undefined) updateData['apiaryId'] = dto.apiaryId;
    if (dto.harvestDate !== undefined) updateData['harvestDate'] = dto.harvestDate;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.quality !== undefined) updateData['quality'] = dto.quality;
    if (dto.floralSource !== undefined) updateData['floralSource'] = dto.floralSource;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).honeyProduction.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'HoneyProduction',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_PRODUCTION_UPDATED, updated, user);

    console.log(`[ProductionService] Honey production updated: ${id}`);
    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: ProductionFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.apiaryId) where['apiaryId'] = query.apiaryId;
    if (query.quality) where['quality'] = query.quality;
    if (query.periodStart || query.periodEnd) {
      where['harvestDate'] = {
        ...(query.periodStart && { gte: new Date(query.periodStart) }),
        ...(query.periodEnd && { lte: new Date(query.periodEnd) }),
      };
    }

    return where;
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
      console.error(
        `Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
