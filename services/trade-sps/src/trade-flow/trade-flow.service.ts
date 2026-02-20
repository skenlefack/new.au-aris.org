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
  TOPIC_MS_TRADE_FLOW_CREATED,
  TOPIC_MS_TRADE_FLOW_UPDATED,
} from '../kafka-topics';
import { CreateTradeFlowDto } from './dto/create-trade-flow.dto';
import { UpdateTradeFlowDto } from './dto/update-trade-flow.dto';
import type { TradeFlowFilterDto } from './dto/trade-flow-filter.dto';
import type { TradeFlowEntity } from './entities/trade-flow.entity';

const SERVICE_NAME = 'trade-sps-service';

@Injectable()
export class TradeFlowService {
  private readonly logger = new Logger(TradeFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateTradeFlowDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TradeFlowEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const flow = await this.prisma.tradeFlow.create({
      data: {
        exportCountryId: dto.exportCountryId,
        importCountryId: dto.importCountryId,
        speciesId: dto.speciesId,
        commodity: dto.commodity,
        flowDirection: dto.flowDirection,
        quantity: dto.quantity,
        unit: dto.unit,
        valueFob: dto.valueFob ?? null,
        currency: dto.currency,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        hsCode: dto.hsCode ?? null,
        spsStatus: dto.spsStatus ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('TradeFlow', flow.id, 'CREATE', user, classification, {
      newVersion: flow as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_TRADE_FLOW_CREATED, flow, user);

    this.logger.log(`Trade flow created: ${flow.id} (commodity=${dto.commodity})`);
    return { data: flow as TradeFlowEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: TradeFlowFilterDto,
  ): Promise<PaginatedResponse<TradeFlowEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.tradeFlow.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.tradeFlow.count({ where }),
    ]);

    return {
      data: data as TradeFlowEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TradeFlowEntity>> {
    const flow = await this.prisma.tradeFlow.findUnique({ where: { id } });

    if (!flow) {
      throw new NotFoundException(`Trade flow ${id} not found`);
    }

    this.verifyTenantAccess(user, flow.tenantId);

    return { data: flow as TradeFlowEntity };
  }

  async update(
    id: string,
    dto: UpdateTradeFlowDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TradeFlowEntity>> {
    const existing = await this.prisma.tradeFlow.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Trade flow ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.exportCountryId !== undefined) updateData['exportCountryId'] = dto.exportCountryId;
    if (dto.importCountryId !== undefined) updateData['importCountryId'] = dto.importCountryId;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.commodity !== undefined) updateData['commodity'] = dto.commodity;
    if (dto.flowDirection !== undefined) updateData['flowDirection'] = dto.flowDirection;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.valueFob !== undefined) updateData['valueFob'] = dto.valueFob;
    if (dto.currency !== undefined) updateData['currency'] = dto.currency;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.hsCode !== undefined) updateData['hsCode'] = dto.hsCode;
    if (dto.spsStatus !== undefined) updateData['spsStatus'] = dto.spsStatus;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.tradeFlow.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'TradeFlow',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_TRADE_FLOW_UPDATED, updated, user);

    this.logger.log(`Trade flow updated: ${id}`);
    return { data: updated as TradeFlowEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: TradeFlowFilterDto,
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

    if (filter.exportCountryId) where['exportCountryId'] = filter.exportCountryId;
    if (filter.importCountryId) where['importCountryId'] = filter.importCountryId;
    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.commodity) where['commodity'] = filter.commodity;
    if (filter.flowDirection) where['flowDirection'] = filter.flowDirection;
    if (filter.periodStart || filter.periodEnd) {
      where['periodStart'] = {
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
    throw new NotFoundException('Trade flow not found');
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
        `Failed to publish ${topic} for flow ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
