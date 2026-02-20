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
import { CreateSlaughterDto } from './dto/create-slaughter.dto';
import { UpdateSlaughterDto } from './dto/update-slaughter.dto';
import type { SlaughterFilterDto } from './dto/slaughter-filter.dto';
import type { SlaughterRecordEntity } from './entities/slaughter.entity';
import {
  TOPIC_MS_LIVESTOCK_SLAUGHTER_RECORDED,
  TOPIC_MS_LIVESTOCK_SLAUGHTER_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'livestock-prod-service';

@Injectable()
export class SlaughterService {
  private readonly logger = new Logger(SlaughterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateSlaughterDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SlaughterRecordEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const record = await this.prisma.slaughterRecord.create({
      data: {
        speciesId: dto.speciesId,
        facilityId: dto.facilityId,
        count: dto.count,
        condemnations: dto.condemnations,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        geoEntityId: dto.geoEntityId,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('SlaughterRecord', record.id, 'CREATE', user, classification, {
      newVersion: record as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_SLAUGHTER_RECORDED, record, user);

    this.logger.log(`Slaughter record created: ${record.id} (facility=${dto.facilityId})`);
    return { data: record as SlaughterRecordEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: SlaughterFilterDto,
  ): Promise<PaginatedResponse<SlaughterRecordEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.slaughterRecord.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.slaughterRecord.count({ where }),
    ]);

    return {
      data: data as SlaughterRecordEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SlaughterRecordEntity>> {
    const record = await this.prisma.slaughterRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Slaughter record ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record as SlaughterRecordEntity };
  }

  async update(
    id: string,
    dto: UpdateSlaughterDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SlaughterRecordEntity>> {
    const existing = await this.prisma.slaughterRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Slaughter record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.facilityId !== undefined) updateData['facilityId'] = dto.facilityId;
    if (dto.count !== undefined) updateData['count'] = dto.count;
    if (dto.condemnations !== undefined) updateData['condemnations'] = dto.condemnations;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.slaughterRecord.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'SlaughterRecord',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_LIVESTOCK_SLAUGHTER_UPDATED, updated, user);

    this.logger.log(`Slaughter record updated: ${id}`);
    return { data: updated as SlaughterRecordEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: SlaughterFilterDto,
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
    if (filter.facilityId) where['facilityId'] = filter.facilityId;
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
    throw new NotFoundException('Slaughter record not found');
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
        `Failed to publish ${topic} for slaughter record ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
