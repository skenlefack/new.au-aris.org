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
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import type { InventoryFilterDto } from './dto/inventory-filter.dto';
import type { WildlifeInventoryEntity } from './entities/inventory.entity';
import {
  TOPIC_MS_WILDLIFE_INVENTORY_CREATED,
  TOPIC_MS_WILDLIFE_INVENTORY_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'wildlife-service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateInventoryDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeInventoryEntity>> {
    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    const inventory = await this.prisma.wildlifeInventory.create({
      data: {
        speciesId: dto.speciesId,
        geoEntityId: dto.geoEntityId,
        protectedAreaId: dto.protectedAreaId,
        surveyDate: new Date(dto.surveyDate),
        populationEstimate: dto.populationEstimate,
        methodology: dto.methodology,
        confidenceInterval: dto.confidenceInterval,
        conservationStatus: dto.conservationStatus,
        threatLevel: dto.threatLevel,
        coordinates: dto.coordinates,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('WildlifeInventory', inventory.id, 'CREATE', user, classification, {
      newVersion: inventory as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_INVENTORY_CREATED, inventory, user);

    this.logger.log(`Wildlife inventory created: ${inventory.id} (species=${dto.speciesId})`);
    return { data: inventory as WildlifeInventoryEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: InventoryFilterDto,
  ): Promise<PaginatedResponse<WildlifeInventoryEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.wildlifeInventory.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.wildlifeInventory.count({ where }),
    ]);

    return {
      data: data as WildlifeInventoryEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeInventoryEntity>> {
    const inventory = await this.prisma.wildlifeInventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new NotFoundException(`Wildlife inventory ${id} not found`);
    }

    this.verifyTenantAccess(user, inventory.tenantId);

    return { data: inventory as WildlifeInventoryEntity };
  }

  async update(
    id: string,
    dto: UpdateInventoryDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeInventoryEntity>> {
    const existing = await this.prisma.wildlifeInventory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Wildlife inventory ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.protectedAreaId !== undefined) updateData['protectedAreaId'] = dto.protectedAreaId;
    if (dto.surveyDate !== undefined) updateData['surveyDate'] = new Date(dto.surveyDate);
    if (dto.populationEstimate !== undefined) updateData['populationEstimate'] = dto.populationEstimate;
    if (dto.methodology !== undefined) updateData['methodology'] = dto.methodology;
    if (dto.confidenceInterval !== undefined) updateData['confidenceInterval'] = dto.confidenceInterval;
    if (dto.conservationStatus !== undefined) updateData['conservationStatus'] = dto.conservationStatus;
    if (dto.threatLevel !== undefined) updateData['threatLevel'] = dto.threatLevel;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.wildlifeInventory.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'WildlifeInventory',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_WILDLIFE_INVENTORY_UPDATED, updated, user);

    this.logger.log(`Wildlife inventory updated: ${id}`);
    return { data: updated as WildlifeInventoryEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: InventoryFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.protectedAreaId) where['protectedAreaId'] = filter.protectedAreaId;
    if (filter.conservationStatus) where['conservationStatus'] = filter.conservationStatus;
    if (filter.threatLevel) where['threatLevel'] = filter.threatLevel;
    if (filter.periodStart || filter.periodEnd) {
      where['surveyDate'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Wildlife inventory not found');
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
        `Failed to publish ${topic} for inventory ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
