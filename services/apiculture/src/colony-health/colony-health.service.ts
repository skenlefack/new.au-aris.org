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
import { CreateColonyHealthDto } from './dto/create-colony-health.dto';
import { UpdateColonyHealthDto } from './dto/update-colony-health.dto';
import type { ColonyHealthFilterDto } from './dto/colony-health-filter.dto';
import type { ColonyHealthEntity } from './entities/colony-health.entity';
import {
  TOPIC_MS_APICULTURE_HEALTH_INSPECTED,
  TOPIC_MS_APICULTURE_HEALTH_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

@Injectable()
export class ColonyHealthService {
  private readonly logger = new Logger(ColonyHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateColonyHealthDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ColonyHealthEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const inspection = await this.prisma.colonyHealth.create({
      data: {
        apiaryId: dto.apiaryId,
        inspectionDate: dto.inspectionDate,
        colonyStrength: dto.colonyStrength,
        diseases: dto.diseases,
        treatments: dto.treatments,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('ColonyHealth', inspection.id, 'CREATE', user, classification, {
      newVersion: inspection as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_HEALTH_INSPECTED, inspection, user);

    this.logger.log(`Colony health inspection created: ${inspection.id} (apiary=${dto.apiaryId})`);
    return { data: inspection as ColonyHealthEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: ColonyHealthFilterDto,
  ): Promise<PaginatedResponse<ColonyHealthEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.colonyHealth.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.colonyHealth.count({ where }),
    ]);

    return {
      data: data as ColonyHealthEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ColonyHealthEntity>> {
    const inspection = await this.prisma.colonyHealth.findUnique({
      where: { id },
    });

    if (!inspection) {
      throw new NotFoundException(`Colony health inspection ${id} not found`);
    }

    this.verifyTenantAccess(user, inspection.tenantId);

    return { data: inspection as ColonyHealthEntity };
  }

  async update(
    id: string,
    dto: UpdateColonyHealthDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ColonyHealthEntity>> {
    const existing = await this.prisma.colonyHealth.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Colony health inspection ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.apiaryId !== undefined) updateData['apiaryId'] = dto.apiaryId;
    if (dto.inspectionDate !== undefined) updateData['inspectionDate'] = dto.inspectionDate;
    if (dto.colonyStrength !== undefined) updateData['colonyStrength'] = dto.colonyStrength;
    if (dto.diseases !== undefined) updateData['diseases'] = dto.diseases;
    if (dto.treatments !== undefined) updateData['treatments'] = dto.treatments;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.colonyHealth.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'ColonyHealth',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_HEALTH_UPDATED, updated, user);

    this.logger.log(`Colony health inspection updated: ${id}`);
    return { data: updated as ColonyHealthEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: ColonyHealthFilterDto,
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
    if (filter.colonyStrength) where['colonyStrength'] = filter.colonyStrength;
    if (filter.disease) where['diseases'] = { has: filter.disease };

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Colony health inspection not found');
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
        `Failed to publish ${topic} for colony health ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
