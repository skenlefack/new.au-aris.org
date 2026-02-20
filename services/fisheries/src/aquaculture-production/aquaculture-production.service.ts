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
import { CreateAquacultureProductionDto } from './dto/create-aquaculture-production.dto';
import { UpdateAquacultureProductionDto } from './dto/update-aquaculture-production.dto';
import type { AquacultureProductionFilterDto } from './dto/aquaculture-production-filter.dto';
import type { AquacultureProductionEntity } from './entities/aquaculture-production.entity';
import {
  TOPIC_MS_FISHERIES_AQUACULTURE_HARVESTED,
  TOPIC_MS_FISHERIES_AQUACULTURE_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'fisheries-service';

@Injectable()
export class AquacultureProductionService {
  private readonly logger = new Logger(AquacultureProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateAquacultureProductionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureProductionEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const production = await this.prisma.aquacultureProduction.create({
      data: {
        farmId: dto.farmId,
        speciesId: dto.speciesId,
        harvestDate: new Date(dto.harvestDate),
        quantityKg: dto.quantityKg,
        methodOfCulture: dto.methodOfCulture,
        feedUsedKg: dto.feedUsedKg,
        fcr: dto.fcr,
        batchId: dto.batchId,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('AquacultureProduction', production.id, 'CREATE', user, classification, {
      newVersion: production as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_AQUACULTURE_HARVESTED, production, user);

    this.logger.log(`Aquaculture production recorded: ${production.id} (farm=${dto.farmId}, qty=${dto.quantityKg}kg)`);
    return { data: production as AquacultureProductionEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: AquacultureProductionFilterDto,
  ): Promise<PaginatedResponse<AquacultureProductionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.aquacultureProduction.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.aquacultureProduction.count({ where }),
    ]);

    return {
      data: data as AquacultureProductionEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureProductionEntity>> {
    const production = await this.prisma.aquacultureProduction.findUnique({
      where: { id },
    });

    if (!production) {
      throw new NotFoundException(`Aquaculture production ${id} not found`);
    }

    this.verifyTenantAccess(user, production.tenantId);

    return { data: production as AquacultureProductionEntity };
  }

  async update(
    id: string,
    dto: UpdateAquacultureProductionDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureProductionEntity>> {
    const existing = await this.prisma.aquacultureProduction.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Aquaculture production ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.farmId !== undefined) updateData['farmId'] = dto.farmId;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.harvestDate !== undefined) updateData['harvestDate'] = new Date(dto.harvestDate);
    if (dto.quantityKg !== undefined) updateData['quantityKg'] = dto.quantityKg;
    if (dto.methodOfCulture !== undefined) updateData['methodOfCulture'] = dto.methodOfCulture;
    if (dto.feedUsedKg !== undefined) updateData['feedUsedKg'] = dto.feedUsedKg;
    if (dto.fcr !== undefined) updateData['fcr'] = dto.fcr;
    if (dto.batchId !== undefined) updateData['batchId'] = dto.batchId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.aquacultureProduction.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'AquacultureProduction',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_FISHERIES_AQUACULTURE_UPDATED, updated, user);

    this.logger.log(`Aquaculture production updated: ${id}`);
    return { data: updated as AquacultureProductionEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: AquacultureProductionFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.farmId) where['farmId'] = filter.farmId;
    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.methodOfCulture) where['methodOfCulture'] = filter.methodOfCulture;
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
    throw new NotFoundException('Aquaculture production not found');
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
