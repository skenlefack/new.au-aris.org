import {
  Injectable,
  NotFoundException,
  ConflictException,
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
import { CreateWaterStressDto } from './dto/create-water-stress.dto';
import { UpdateWaterStressDto } from './dto/update-water-stress.dto';
import type { WaterStressFilterDto } from './dto/water-stress-filter.dto';
import type { WaterStressIndexEntity } from './entities/water-stress.entity';
import {
  TOPIC_MS_CLIMATE_WATER_STRESS_CREATED,
  TOPIC_MS_CLIMATE_WATER_STRESS_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'climate-env-service';

@Injectable()
export class WaterStressService {
  private readonly logger = new Logger(WaterStressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateWaterStressDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WaterStressIndexEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    // Business rule: unique constraint per tenant+geo+period
    const existing = await this.prisma.waterStressIndex.findFirst({
      where: {
        tenantId: user.tenantId,
        geoEntityId: dto.geoEntityId,
        period: dto.period,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Water stress record already exists for tenant=${user.tenantId}, geo=${dto.geoEntityId}, period=${dto.period}`,
      );
    }

    const record = await this.prisma.waterStressIndex.create({
      data: {
        geoEntityId: dto.geoEntityId,
        period: dto.period,
        index: dto.index,
        waterAvailability: dto.waterAvailability,
        irrigatedAreaPct: dto.irrigatedAreaPct,
        source: dto.source,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('WaterStressIndex', record.id, 'CREATE', user, classification, {
      newVersion: record as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_WATER_STRESS_CREATED, record, user);

    this.logger.log(`Water stress record created: ${record.id} (geo=${dto.geoEntityId}, period=${dto.period})`);
    return { data: record as WaterStressIndexEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: WaterStressFilterDto,
  ): Promise<PaginatedResponse<WaterStressIndexEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.waterStressIndex.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.waterStressIndex.count({ where }),
    ]);

    return {
      data: data as WaterStressIndexEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WaterStressIndexEntity>> {
    const record = await this.prisma.waterStressIndex.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Water stress record ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record as WaterStressIndexEntity };
  }

  async update(
    id: string,
    dto: UpdateWaterStressDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WaterStressIndexEntity>> {
    const existing = await this.prisma.waterStressIndex.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Water stress record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.period !== undefined) updateData['period'] = dto.period;
    if (dto.index !== undefined) updateData['index'] = dto.index;
    if (dto.waterAvailability !== undefined) updateData['waterAvailability'] = dto.waterAvailability;
    if (dto.irrigatedAreaPct !== undefined) updateData['irrigatedAreaPct'] = dto.irrigatedAreaPct;
    if (dto.source !== undefined) updateData['source'] = dto.source;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.waterStressIndex.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'WaterStressIndex',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_CLIMATE_WATER_STRESS_UPDATED, updated, user);

    this.logger.log(`Water stress record updated: ${id}`);
    return { data: updated as WaterStressIndexEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: WaterStressFilterDto,
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

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.period) where['period'] = filter.period;
    if (filter.minIndex !== undefined || filter.maxIndex !== undefined) {
      where['index'] = {
        ...(filter.minIndex !== undefined && { gte: filter.minIndex }),
        ...(filter.maxIndex !== undefined && { lte: filter.maxIndex }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Water stress record not found');
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
        `Failed to publish ${topic} for water stress record ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
