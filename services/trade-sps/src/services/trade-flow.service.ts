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
  TOPIC_MS_TRADE_FLOW_CREATED,
  TOPIC_MS_TRADE_FLOW_UPDATED,
} from '../kafka-topics.js';
import type { CreateTradeFlowInput, UpdateTradeFlowInput, TradeFlowFilterInput } from '../schemas/trade-flow.schema.js';

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

export class TradeFlowService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateTradeFlowInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const tradeFlow = await (this.prisma as any).tradeFlow.create({
      data: {
        tenantId: user.tenantId,
        exportCountryId: dto.exportCountryId,
        importCountryId: dto.importCountryId,
        speciesId: dto.speciesId,
        commodity: dto.commodity,
        flowDirection: dto.flowDirection,
        quantity: dto.quantity,
        unit: dto.unit,
        valueFob: dto.valueFob,
        currency: dto.currency,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
        hsCode: dto.hsCode,
        spsStatus: dto.spsStatus,
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('TradeFlow', tradeFlow.id, 'CREATE', user, 'PARTNER', {
      newVersion: tradeFlow,
    });

    await this.publishEvent(TOPIC_MS_TRADE_FLOW_CREATED, tradeFlow, user);

    return { data: tradeFlow };
  }

  async findAll(
    user: AuthenticatedUser,
    query: TradeFlowFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).tradeFlow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).tradeFlow.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const tradeFlow = await (this.prisma as any).tradeFlow.findUnique({
      where: { id },
    });

    if (!tradeFlow) {
      throw new HttpError(404, `Trade flow ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      tradeFlow.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Trade flow ${id} not found`);
    }

    return { data: tradeFlow };
  }

  async update(
    id: string,
    dto: UpdateTradeFlowInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).tradeFlow.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Trade flow ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Trade flow ${id} not found`);
    }

    const tradeFlow = await (this.prisma as any).tradeFlow.update({
      where: { id },
      data: {
        ...(dto.exportCountryId !== undefined && { exportCountryId: dto.exportCountryId }),
        ...(dto.importCountryId !== undefined && { importCountryId: dto.importCountryId }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.commodity !== undefined && { commodity: dto.commodity }),
        ...(dto.flowDirection !== undefined && { flowDirection: dto.flowDirection }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.valueFob !== undefined && { valueFob: dto.valueFob }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.periodStart !== undefined && { periodStart: new Date(dto.periodStart) }),
        ...(dto.periodEnd !== undefined && { periodEnd: new Date(dto.periodEnd) }),
        ...(dto.hsCode !== undefined && { hsCode: dto.hsCode }),
        ...(dto.spsStatus !== undefined && { spsStatus: dto.spsStatus }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    this.audit.log('TradeFlow', tradeFlow.id, 'UPDATE', user, 'PARTNER', {
      previousVersion: existing,
      newVersion: tradeFlow,
    });

    await this.publishEvent(TOPIC_MS_TRADE_FLOW_UPDATED, tradeFlow, user);

    return { data: tradeFlow };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: TradeFlowFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.exportCountryId) where['exportCountryId'] = query.exportCountryId;
    if (query.importCountryId) where['importCountryId'] = query.importCountryId;
    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.commodity) where['commodity'] = { contains: query.commodity, mode: 'insensitive' };
    if (query.flowDirection) where['flowDirection'] = query.flowDirection;

    if (query.periodStart || query.periodEnd) {
      where['periodStart'] = {};
      if (query.periodStart) {
        (where['periodStart'] as Record<string, unknown>)['gte'] = new Date(query.periodStart);
      }
      if (query.periodEnd) {
        (where['periodStart'] as Record<string, unknown>)['lte'] = new Date(query.periodEnd);
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
