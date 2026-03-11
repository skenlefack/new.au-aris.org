import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TenantLevel } from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AuditService } from './audit.service.js';
import {
  TOPIC_MS_TRADE_PRICE_RECORDED,
  TOPIC_MS_TRADE_PRICE_UPDATED,
} from '../kafka-topics.js';
import type { CreateMarketPriceInput, UpdateMarketPriceInput, MarketPriceFilterInput } from '../schemas/market-price.schema.js';

const SERVICE_NAME = 'trade-sps-service';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class MarketPriceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateMarketPriceInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const marketPrice = await (this.prisma as any).marketPrice.create({
      data: {
        tenantId: user.tenantId,
        marketId: dto.marketId,
        speciesId: dto.speciesId,
        commodity: dto.commodity,
        priceType: dto.priceType,
        price: dto.price,
        currency: dto.currency,
        unit: dto.unit,
        date: dto.date ? new Date(dto.date) : new Date(),
        source: dto.source,
        dataClassification: dto.dataClassification ?? 'PUBLIC',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('MarketPrice', marketPrice.id, 'CREATE', user, 'PUBLIC', {
      newVersion: marketPrice,
    });

    await this.publishEvent(TOPIC_MS_TRADE_PRICE_RECORDED, marketPrice, user);

    return { data: marketPrice };
  }

  async findAll(
    user: AuthenticatedUser,
    query: MarketPriceFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).marketPrice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).marketPrice.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const marketPrice = await (this.prisma as any).marketPrice.findUnique({
      where: { id },
    });

    if (!marketPrice) {
      throw new HttpError(404, `Market price ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      marketPrice.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Market price ${id} not found`);
    }

    return { data: marketPrice };
  }

  async update(
    id: string,
    dto: UpdateMarketPriceInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).marketPrice.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Market price ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Market price ${id} not found`);
    }

    const marketPrice = await (this.prisma as any).marketPrice.update({
      where: { id },
      data: {
        ...(dto.marketId !== undefined && { marketId: dto.marketId }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.commodity !== undefined && { commodity: dto.commodity }),
        ...(dto.priceType !== undefined && { priceType: dto.priceType }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    this.audit.log('MarketPrice', marketPrice.id, 'UPDATE', user, 'PUBLIC', {
      previousVersion: existing,
      newVersion: marketPrice,
    });

    await this.publishEvent(TOPIC_MS_TRADE_PRICE_UPDATED, marketPrice, user);

    return { data: marketPrice };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: MarketPriceFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.marketId) where['marketId'] = query.marketId;
    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.commodity) where['commodity'] = { contains: query.commodity, mode: 'insensitive' };
    if (query.priceType) where['priceType'] = query.priceType;

    if (query.periodStart || query.periodEnd) {
      where['date'] = {};
      if (query.periodStart) {
        (where['date'] as Record<string, unknown>)['gte'] = new Date(query.periodStart);
      }
      if (query.periodEnd) {
        (where['date'] as Record<string, unknown>)['lte'] = new Date(query.periodEnd);
      }
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
