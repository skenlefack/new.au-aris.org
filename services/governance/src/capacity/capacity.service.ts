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
import { CreateCapacityDto } from './dto/create-capacity.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';
import type { CapacityFilterDto } from './dto/capacity-filter.dto';
import type { InstitutionalCapacityEntity } from './entities/capacity.entity';
import {
  TOPIC_MS_GOVERNANCE_CAPACITY_CREATED,
  TOPIC_MS_GOVERNANCE_CAPACITY_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'governance-service';

@Injectable()
export class CapacityService {
  private readonly logger = new Logger(CapacityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCapacityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<InstitutionalCapacityEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    // Business rule: unique constraint per tenant+year+organizationName
    const existing = await this.prisma.institutionalCapacity.findFirst({
      where: {
        tenantId: user.tenantId,
        year: dto.year,
        organizationName: dto.organizationName,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Capacity record already exists for tenant=${user.tenantId}, year=${dto.year}, organization=${dto.organizationName}`,
      );
    }

    const capacity = await this.prisma.institutionalCapacity.create({
      data: {
        year: dto.year,
        organizationName: dto.organizationName,
        staffCount: dto.staffCount,
        budgetUsd: dto.budgetUsd,
        pvsSelfAssessmentScore: dto.pvsSelfAssessmentScore ?? null,
        oieStatus: dto.oieStatus ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('InstitutionalCapacity', capacity.id, 'CREATE', user, classification, {
      newVersion: capacity as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_CAPACITY_CREATED, capacity, user);

    this.logger.log(`Capacity record created: ${capacity.id} (org=${dto.organizationName}, year=${dto.year})`);
    return { data: capacity as InstitutionalCapacityEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: CapacityFilterDto,
  ): Promise<PaginatedResponse<InstitutionalCapacityEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.institutionalCapacity.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.institutionalCapacity.count({ where }),
    ]);

    return {
      data: data as InstitutionalCapacityEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<InstitutionalCapacityEntity>> {
    const capacity = await this.prisma.institutionalCapacity.findUnique({
      where: { id },
    });

    if (!capacity) {
      throw new NotFoundException(`Capacity record ${id} not found`);
    }

    this.verifyTenantAccess(user, capacity.tenantId);

    return { data: capacity as InstitutionalCapacityEntity };
  }

  async update(
    id: string,
    dto: UpdateCapacityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<InstitutionalCapacityEntity>> {
    const existing = await this.prisma.institutionalCapacity.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Capacity record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.year !== undefined) updateData['year'] = dto.year;
    if (dto.organizationName !== undefined) updateData['organizationName'] = dto.organizationName;
    if (dto.staffCount !== undefined) updateData['staffCount'] = dto.staffCount;
    if (dto.budgetUsd !== undefined) updateData['budgetUsd'] = dto.budgetUsd;
    if (dto.pvsSelfAssessmentScore !== undefined) updateData['pvsSelfAssessmentScore'] = dto.pvsSelfAssessmentScore;
    if (dto.oieStatus !== undefined) updateData['oieStatus'] = dto.oieStatus;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.institutionalCapacity.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'InstitutionalCapacity',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_CAPACITY_UPDATED, updated, user);

    this.logger.log(`Capacity record updated: ${id}`);
    return { data: updated as InstitutionalCapacityEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CapacityFilterDto,
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

    if (filter.year) where['year'] = filter.year;
    if (filter.organizationName) where['organizationName'] = filter.organizationName;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Capacity record not found');
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
        `Failed to publish ${topic} for capacity ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
