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
import { CreateAquacultureFarmDto } from './dto/create-aquaculture-farm.dto';
import { UpdateAquacultureFarmDto } from './dto/update-aquaculture-farm.dto';
import type { AquacultureFarmFilterDto } from './dto/aquaculture-farm-filter.dto';
import type { AquacultureFarmEntity } from './entities/aquaculture-farm.entity';
import {
  TOPIC_MS_FISHERIES_FARM_CREATED,
  TOPIC_MS_FISHERIES_FARM_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'fisheries-service';

@Injectable()
export class AquacultureFarmService {
  private readonly logger = new Logger(AquacultureFarmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateAquacultureFarmDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureFarmEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const farm = await this.prisma.aquacultureFarm.create({
      data: {
        name: dto.name,
        geoEntityId: dto.geoEntityId,
        coordinates: dto.coordinates,
        farmType: dto.farmType,
        waterSource: dto.waterSource,
        areaHectares: dto.areaHectares,
        speciesIds: dto.speciesIds,
        productionCapacityTonnes: dto.productionCapacityTonnes,
        isActive: dto.isActive ?? true,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('AquacultureFarm', farm.id, 'CREATE', user, classification, {
      newVersion: farm as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_FARM_CREATED, farm, user);

    this.logger.log(`Aquaculture farm created: ${farm.id} (${dto.name})`);
    return { data: farm as AquacultureFarmEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: AquacultureFarmFilterDto,
  ): Promise<PaginatedResponse<AquacultureFarmEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.aquacultureFarm.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.aquacultureFarm.count({ where }),
    ]);

    return {
      data: data as AquacultureFarmEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureFarmEntity>> {
    const farm = await this.prisma.aquacultureFarm.findUnique({
      where: { id },
    });

    if (!farm) {
      throw new NotFoundException(`Aquaculture farm ${id} not found`);
    }

    this.verifyTenantAccess(user, farm.tenantId);

    return { data: farm as AquacultureFarmEntity };
  }

  async update(
    id: string,
    dto: UpdateAquacultureFarmDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<AquacultureFarmEntity>> {
    const existing = await this.prisma.aquacultureFarm.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Aquaculture farm ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.farmType !== undefined) updateData['farmType'] = dto.farmType;
    if (dto.waterSource !== undefined) updateData['waterSource'] = dto.waterSource;
    if (dto.areaHectares !== undefined) updateData['areaHectares'] = dto.areaHectares;
    if (dto.speciesIds !== undefined) updateData['speciesIds'] = dto.speciesIds;
    if (dto.productionCapacityTonnes !== undefined) updateData['productionCapacityTonnes'] = dto.productionCapacityTonnes;
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.aquacultureFarm.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'AquacultureFarm',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_FISHERIES_FARM_UPDATED, updated, user);

    this.logger.log(`Aquaculture farm updated: ${id}`);
    return { data: updated as AquacultureFarmEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: AquacultureFarmFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.farmType) where['farmType'] = filter.farmType;
    if (filter.waterSource) where['waterSource'] = filter.waterSource;
    if (filter.isActive !== undefined) where['isActive'] = filter.isActive;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Aquaculture farm not found');
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
        `Failed to publish ${topic} for farm ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
