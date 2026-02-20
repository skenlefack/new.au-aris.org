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
import { CreateHoneyProductionDto } from './dto/create-production.dto';
import { UpdateHoneyProductionDto } from './dto/update-production.dto';
import type { ProductionFilterDto } from './dto/production-filter.dto';
import type { HoneyProductionEntity } from './entities/production.entity';
import {
  TOPIC_MS_APICULTURE_PRODUCTION_RECORDED,
  TOPIC_MS_APICULTURE_PRODUCTION_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateHoneyProductionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HoneyProductionEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const production = await this.prisma.honeyProduction.create({
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

    this.audit.log('HoneyProduction', production.id, 'CREATE', user, classification, {
      newVersion: production as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_PRODUCTION_RECORDED, production, user);

    this.logger.log(`Honey production recorded: ${production.id} (apiary=${dto.apiaryId})`);
    return { data: production as HoneyProductionEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: ProductionFilterDto,
  ): Promise<PaginatedResponse<HoneyProductionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.honeyProduction.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.honeyProduction.count({ where }),
    ]);

    return {
      data: data as HoneyProductionEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HoneyProductionEntity>> {
    const production = await this.prisma.honeyProduction.findUnique({
      where: { id },
    });

    if (!production) {
      throw new NotFoundException(`Honey production record ${id} not found`);
    }

    this.verifyTenantAccess(user, production.tenantId);

    return { data: production as HoneyProductionEntity };
  }

  async update(
    id: string,
    dto: UpdateHoneyProductionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<HoneyProductionEntity>> {
    const existing = await this.prisma.honeyProduction.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Honey production record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.apiaryId !== undefined) updateData['apiaryId'] = dto.apiaryId;
    if (dto.harvestDate !== undefined) updateData['harvestDate'] = dto.harvestDate;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.quality !== undefined) updateData['quality'] = dto.quality;
    if (dto.floralSource !== undefined) updateData['floralSource'] = dto.floralSource;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.honeyProduction.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'HoneyProduction',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_PRODUCTION_UPDATED, updated, user);

    this.logger.log(`Honey production updated: ${id}`);
    return { data: updated as HoneyProductionEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: ProductionFilterDto,
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

    if (filter.apiaryId) where['apiaryId'] = filter.apiaryId;
    if (filter.quality) where['quality'] = filter.quality;
    if (filter.periodStart || filter.periodEnd) {
      where['harvestDate'] = {
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
    throw new NotFoundException('Honey production record not found');
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
        `Failed to publish ${topic} for production ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
