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
import { CreateRangelandDto } from './dto/create-rangeland.dto';
import { UpdateRangelandDto } from './dto/update-rangeland.dto';
import type { RangelandFilterDto } from './dto/rangeland-filter.dto';
import type { RangelandConditionEntity } from './entities/rangeland.entity';
import {
  TOPIC_MS_CLIMATE_RANGELAND_ASSESSED,
  TOPIC_MS_CLIMATE_RANGELAND_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'climate-env-service';

@Injectable()
export class RangelandService {
  private readonly logger = new Logger(RangelandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateRangelandDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<RangelandConditionEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const record = await this.prisma.rangelandCondition.create({
      data: {
        geoEntityId: dto.geoEntityId,
        assessmentDate: new Date(dto.assessmentDate),
        ndviIndex: dto.ndviIndex,
        biomassTonsPerHa: dto.biomassTonsPerHa,
        degradationLevel: dto.degradationLevel,
        carryingCapacity: dto.carryingCapacity,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('RangelandCondition', record.id, 'CREATE', user, classification, {
      newVersion: record as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_RANGELAND_ASSESSED, record, user);

    this.logger.log(`Rangeland condition created: ${record.id} (geo=${dto.geoEntityId})`);
    return { data: record as RangelandConditionEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: RangelandFilterDto,
  ): Promise<PaginatedResponse<RangelandConditionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.rangelandCondition.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.rangelandCondition.count({ where }),
    ]);

    return {
      data: data as RangelandConditionEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<RangelandConditionEntity>> {
    const record = await this.prisma.rangelandCondition.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Rangeland condition ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record as RangelandConditionEntity };
  }

  async update(
    id: string,
    dto: UpdateRangelandDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<RangelandConditionEntity>> {
    const existing = await this.prisma.rangelandCondition.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Rangeland condition ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.assessmentDate !== undefined) updateData['assessmentDate'] = new Date(dto.assessmentDate);
    if (dto.ndviIndex !== undefined) updateData['ndviIndex'] = dto.ndviIndex;
    if (dto.biomassTonsPerHa !== undefined) updateData['biomassTonsPerHa'] = dto.biomassTonsPerHa;
    if (dto.degradationLevel !== undefined) updateData['degradationLevel'] = dto.degradationLevel;
    if (dto.carryingCapacity !== undefined) updateData['carryingCapacity'] = dto.carryingCapacity;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.rangelandCondition.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'RangelandCondition',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_CLIMATE_RANGELAND_UPDATED, updated, user);

    this.logger.log(`Rangeland condition updated: ${id}`);
    return { data: updated as RangelandConditionEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: RangelandFilterDto,
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
    if (filter.degradationLevel) where['degradationLevel'] = filter.degradationLevel;
    if (filter.periodStart || filter.periodEnd) {
      where['assessmentDate'] = {
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
    throw new NotFoundException('Rangeland condition not found');
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
        `Failed to publish ${topic} for rangeland condition ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
