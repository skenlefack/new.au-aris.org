import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import {
  TOPIC_MS_TRADE_PRICE_RECORDED,
  TOPIC_MS_TRADE_PRICE_UPDATED,
} from '../kafka-topics';
import { CreateMarketPriceDto } from './dto/create-market-price.dto';
import { UpdateMarketPriceDto } from './dto/update-market-price.dto';
import type { MarketPriceFilterDto } from './dto/market-price-filter.dto';
import type { MarketPriceEntity } from './entities/market-price.entity';

const SERVICE_NAME = 'trade-sps-service';

@Injectable()
export class MarketPriceService {
  private readonly logger = new Logger(MarketPriceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateMarketPriceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<MarketPriceEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const price = await this.prisma.marketPrice.create({
      data: {
        marketId: dto.marketId,
        speciesId: dto.speciesId,
        commodity: dto.commodity,
        priceType: dto.priceType,
        price: dto.price,
        currency: dto.currency,
        unit: dto.unit,
        date: new Date(dto.date),
        source: dto.source ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('MarketPrice', price.id, 'CREATE', user, classification, {
      newVersion: price as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_TRADE_PRICE_RECORDED, price, user);

    this.logger.log(`Market price created: ${price.id} (commodity=${dto.commodity})`);
    return { data: price as MarketPriceEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: MarketPriceFilterDto,
  ): Promise<PaginatedResponse<MarketPriceEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.marketPrice.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.marketPrice.count({ where }),
    ]);

    return {
      data: data as MarketPriceEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<MarketPriceEntity>> {
    const price = await this.prisma.marketPrice.findUnique({ where: { id } });

    if (!price) {
      throw new NotFoundException(`Market price ${id} not found`);
    }

    this.verifyTenantAccess(user, price.tenantId);

    return { data: price as MarketPriceEntity };
  }

  async update(
    id: string,
    dto: UpdateMarketPriceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<MarketPriceEntity>> {
    const existing = await this.prisma.marketPrice.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Market price ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.marketId !== undefined) updateData['marketId'] = dto.marketId;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.commodity !== undefined) updateData['commodity'] = dto.commodity;
    if (dto.priceType !== undefined) updateData['priceType'] = dto.priceType;
    if (dto.price !== undefined) updateData['price'] = dto.price;
    if (dto.currency !== undefined) updateData['currency'] = dto.currency;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.date !== undefined) updateData['date'] = new Date(dto.date);
    if (dto.source !== undefined) updateData['source'] = dto.source;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.marketPrice.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'MarketPrice',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_TRADE_PRICE_UPDATED, updated, user);

    this.logger.log(`Market price updated: ${id}`);
    return { data: updated as MarketPriceEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: MarketPriceFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Tenant scoping
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      // REC sees own + children — service-level filter
      // Phase 2: resolve child tenantIds from tenant service
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter (sees all)

    if (filter.marketId) where['marketId'] = filter.marketId;
    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.commodity) where['commodity'] = filter.commodity;
    if (filter.priceType) where['priceType'] = filter.priceType;
    if (filter.periodStart || filter.periodEnd) {
      where['date'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Market price not found');
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
      await this.kafkaProducer.send(topic, payload.id, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for price ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
