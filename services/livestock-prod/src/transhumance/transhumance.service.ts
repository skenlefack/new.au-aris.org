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
import { CreateTranshumanceDto } from './dto/create-transhumance.dto';
import { UpdateTranshumanceDto } from './dto/update-transhumance.dto';
import type { TranshumanceFilterDto } from './dto/transhumance-filter.dto';
import type { TranshumanceCorridorEntity } from './entities/transhumance.entity';
import {
  TOPIC_MS_LIVESTOCK_TRANSHUMANCE_CREATED,
  TOPIC_MS_LIVESTOCK_TRANSHUMANCE_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'livestock-prod-service';

@Injectable()
export class TranshumanceService {
  private readonly logger = new Logger(TranshumanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateTranshumanceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TranshumanceCorridorEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const corridor = await this.prisma.transhumanceCorridor.create({
      data: {
        name: dto.name,
        route: dto.route,
        speciesId: dto.speciesId,
        seasonality: dto.seasonality,
        crossBorder: dto.crossBorder ?? false,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('TranshumanceCorridor', corridor.id, 'CREATE', user, classification, {
      newVersion: corridor as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_TRANSHUMANCE_CREATED, corridor, user);

    this.logger.log(`Transhumance corridor created: ${corridor.id} (name=${dto.name})`);
    return { data: corridor as TranshumanceCorridorEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: TranshumanceFilterDto,
  ): Promise<PaginatedResponse<TranshumanceCorridorEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.transhumanceCorridor.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.transhumanceCorridor.count({ where }),
    ]);

    return {
      data: data as TranshumanceCorridorEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TranshumanceCorridorEntity>> {
    const corridor = await this.prisma.transhumanceCorridor.findUnique({
      where: { id },
    });

    if (!corridor) {
      throw new NotFoundException(`Transhumance corridor ${id} not found`);
    }

    this.verifyTenantAccess(user, corridor.tenantId);

    return { data: corridor as TranshumanceCorridorEntity };
  }

  async update(
    id: string,
    dto: UpdateTranshumanceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TranshumanceCorridorEntity>> {
    const existing = await this.prisma.transhumanceCorridor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Transhumance corridor ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.route !== undefined) updateData['route'] = dto.route;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.seasonality !== undefined) updateData['seasonality'] = dto.seasonality;
    if (dto.crossBorder !== undefined) updateData['crossBorder'] = dto.crossBorder;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.transhumanceCorridor.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'TranshumanceCorridor',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_LIVESTOCK_TRANSHUMANCE_UPDATED, updated, user);

    this.logger.log(`Transhumance corridor updated: ${id}`);
    return { data: updated as TranshumanceCorridorEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: TranshumanceFilterDto,
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
    if (filter.crossBorder !== undefined) where['crossBorder'] = filter.crossBorder;
    if (filter.seasonality) where['seasonality'] = filter.seasonality;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Transhumance corridor not found');
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
        `Failed to publish ${topic} for corridor ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
