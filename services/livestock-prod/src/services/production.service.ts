import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_LIVESTOCK_PRODUCTION_CREATED,
  TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED,
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
import type { CreateProductionInput, UpdateProductionInput, ProductionFilterInput } from '../schemas/production.schema.js';

const SERVICE_NAME = 'livestock-prod-service';

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
  ) {}

  async create(
    dto: CreateProductionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new HttpError(400, 'periodEnd must be after periodStart');
    }

    const record = await (this.prisma as any).productionRecord.create({
      data: {
        tenantId: user.tenantId,
        speciesId: dto.speciesId,
        productType: dto.productType,
        quantity: dto.quantity,
        unit: dto.unit,
        periodStart,
        periodEnd,
        geoEntityId: dto.geoEntityId,
        dataClassification: dto.dataClassification ?? 'PUBLIC',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_PRODUCTION_CREATED, record, user);
    console.log(`[ProductionService] Production record created: ${record.id} type=${record.productType}`);

    return { data: record };
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
      (this.prisma as any).productionRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).productionRecord.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const record = await (this.prisma as any).productionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Production record ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      record.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Production record ${id} not found`);
    }

    return { data: record };
  }

  async update(
    id: string,
    dto: UpdateProductionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).productionRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Production record ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Production record ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.productType !== undefined) updateData['productType'] = dto.productType;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const record = await (this.prisma as any).productionRecord.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED, record, user);
    console.log(`[ProductionService] Production record updated: ${record.id}`);

    return { data: record };
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

    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.productType) where['productType'] = query.productType;
    if (query.geoEntityId) where['geoEntityId'] = query.geoEntityId;
    if (query.year) {
      // Filter by year: periodStart must be within the requested year
      const yearStart = new Date(`${query.year}-01-01T00:00:00Z`);
      const yearEnd = new Date(`${query.year + 1}-01-01T00:00:00Z`);
      where['periodStart'] = { gte: yearStart, lt: yearEnd };
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
