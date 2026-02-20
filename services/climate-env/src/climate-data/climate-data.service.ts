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
import { CreateClimateDataDto } from './dto/create-climate-data.dto';
import { UpdateClimateDataDto } from './dto/update-climate-data.dto';
import type { ClimateDataFilterDto } from './dto/climate-data-filter.dto';
import type { ClimateDataPointEntity } from './entities/climate-data.entity';
import {
  TOPIC_MS_CLIMATE_DATA_RECORDED,
  TOPIC_MS_CLIMATE_DATA_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'climate-env-service';

@Injectable()
export class ClimateDataService {
  private readonly logger = new Logger(ClimateDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateClimateDataDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ClimateDataPointEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const record = await this.prisma.climateDataPoint.create({
      data: {
        geoEntityId: dto.geoEntityId,
        date: new Date(dto.date),
        temperature: dto.temperature,
        rainfall: dto.rainfall,
        humidity: dto.humidity,
        windSpeed: dto.windSpeed,
        source: dto.source,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('ClimateDataPoint', record.id, 'CREATE', user, classification, {
      newVersion: record as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_DATA_RECORDED, record, user);

    this.logger.log(`Climate data point created: ${record.id} (source=${dto.source})`);
    return { data: record as ClimateDataPointEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: ClimateDataFilterDto,
  ): Promise<PaginatedResponse<ClimateDataPointEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.climateDataPoint.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.climateDataPoint.count({ where }),
    ]);

    return {
      data: data as ClimateDataPointEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ClimateDataPointEntity>> {
    const record = await this.prisma.climateDataPoint.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Climate data point ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record as ClimateDataPointEntity };
  }

  async update(
    id: string,
    dto: UpdateClimateDataDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ClimateDataPointEntity>> {
    const existing = await this.prisma.climateDataPoint.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Climate data point ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.date !== undefined) updateData['date'] = new Date(dto.date);
    if (dto.temperature !== undefined) updateData['temperature'] = dto.temperature;
    if (dto.rainfall !== undefined) updateData['rainfall'] = dto.rainfall;
    if (dto.humidity !== undefined) updateData['humidity'] = dto.humidity;
    if (dto.windSpeed !== undefined) updateData['windSpeed'] = dto.windSpeed;
    if (dto.source !== undefined) updateData['source'] = dto.source;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.climateDataPoint.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'ClimateDataPoint',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_CLIMATE_DATA_UPDATED, updated, user);

    this.logger.log(`Climate data point updated: ${id}`);
    return { data: updated as ClimateDataPointEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: ClimateDataFilterDto,
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
    if (filter.source) where['source'] = filter.source;
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
    throw new NotFoundException('Climate data point not found');
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
        `Failed to publish ${topic} for climate data point ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
