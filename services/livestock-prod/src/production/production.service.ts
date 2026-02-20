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
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto';
import type { ProductionFilterDto } from './dto/production-filter.dto';
import type { ProductionRecordEntity } from './entities/production.entity';
import {
  TOPIC_MS_LIVESTOCK_PRODUCTION_RECORDED,
  TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'livestock-prod-service';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateProductionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ProductionRecordEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const record = await this.prisma.productionRecord.create({
      data: {
        speciesId: dto.speciesId,
        productType: dto.productType,
        quantity: dto.quantity,
        unit: dto.unit,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        geoEntityId: dto.geoEntityId,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('ProductionRecord', record.id, 'CREATE', user, classification, {
      newVersion: record as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_PRODUCTION_RECORDED, record, user);

    this.logger.log(`Production record created: ${record.id} (type=${dto.productType})`);
    return { data: record as ProductionRecordEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: ProductionFilterDto,
  ): Promise<PaginatedResponse<ProductionRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.productionRecord.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.productionRecord.count({ where }),
    ]);

    return {
      data: data as ProductionRecordEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ProductionRecordEntity>> {
    const record = await this.prisma.productionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Production record ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record as ProductionRecordEntity };
  }

  async update(
    id: string,
    dto: UpdateProductionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ProductionRecordEntity>> {
    const existing = await this.prisma.productionRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Production record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.productType !== undefined) updateData['productType'] = dto.productType;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.productionRecord.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'ProductionRecord',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_LIVESTOCK_PRODUCTION_UPDATED, updated, user);

    this.logger.log(`Production record updated: ${id}`);
    return { data: updated as ProductionRecordEntity };
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

    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.productType) where['productType'] = filter.productType;
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
    throw new NotFoundException('Production record not found');
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
        `Failed to publish ${topic} for production record ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
