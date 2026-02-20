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
import { CreateStakeholderDto } from './dto/create-stakeholder.dto';
import { UpdateStakeholderDto } from './dto/update-stakeholder.dto';
import type { StakeholderFilterDto } from './dto/stakeholder-filter.dto';
import type { StakeholderRegistryEntity } from './entities/stakeholder.entity';
import {
  TOPIC_MS_GOVERNANCE_STAKEHOLDER_CREATED,
  TOPIC_MS_GOVERNANCE_STAKEHOLDER_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'governance-service';

@Injectable()
export class StakeholderService {
  private readonly logger = new Logger(StakeholderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateStakeholderDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<StakeholderRegistryEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const stakeholder = await this.prisma.stakeholderRegistry.create({
      data: {
        name: dto.name,
        type: dto.type,
        contactPerson: dto.contactPerson ?? null,
        email: dto.email ?? null,
        domains: dto.domains,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('StakeholderRegistry', stakeholder.id, 'CREATE', user, classification, {
      newVersion: stakeholder as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_STAKEHOLDER_CREATED, stakeholder, user);

    this.logger.log(`Stakeholder created: ${stakeholder.id} (name=${dto.name})`);
    return { data: stakeholder as StakeholderRegistryEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: StakeholderFilterDto,
  ): Promise<PaginatedResponse<StakeholderRegistryEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.stakeholderRegistry.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.stakeholderRegistry.count({ where }),
    ]);

    return {
      data: data as StakeholderRegistryEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<StakeholderRegistryEntity>> {
    const stakeholder = await this.prisma.stakeholderRegistry.findUnique({
      where: { id },
    });

    if (!stakeholder) {
      throw new NotFoundException(`Stakeholder ${id} not found`);
    }

    this.verifyTenantAccess(user, stakeholder.tenantId);

    return { data: stakeholder as StakeholderRegistryEntity };
  }

  async update(
    id: string,
    dto: UpdateStakeholderDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<StakeholderRegistryEntity>> {
    const existing = await this.prisma.stakeholderRegistry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Stakeholder ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.contactPerson !== undefined) updateData['contactPerson'] = dto.contactPerson;
    if (dto.email !== undefined) updateData['email'] = dto.email;
    if (dto.domains !== undefined) updateData['domains'] = dto.domains;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.stakeholderRegistry.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'StakeholderRegistry',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_STAKEHOLDER_UPDATED, updated, user);

    this.logger.log(`Stakeholder updated: ${id}`);
    return { data: updated as StakeholderRegistryEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: StakeholderFilterDto,
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

    if (filter.type) where['type'] = filter.type;
    if (filter.domain) where['domains'] = { has: filter.domain };

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Stakeholder not found');
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
        `Failed to publish ${topic} for stakeholder ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
