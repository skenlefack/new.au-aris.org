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
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateHotspotDto } from './dto/update-hotspot.dto';
import type { HotspotFilterDto } from './dto/hotspot-filter.dto';
import type { EnvironmentalHotspotEntity } from './entities/hotspot.entity';
import {
  TOPIC_MS_CLIMATE_HOTSPOT_DETECTED,
  TOPIC_MS_CLIMATE_HOTSPOT_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'climate-env-service';

@Injectable()
export class HotspotService {
  private readonly logger = new Logger(HotspotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateHotspotDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<EnvironmentalHotspotEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const record = await this.prisma.environmentalHotspot.create({
      data: {
        geoEntityId: dto.geoEntityId,
        type: dto.type,
        severity: dto.severity,
        detectedDate: new Date(dto.detectedDate),
        satelliteSource: dto.satelliteSource,
        affectedSpecies: dto.affectedSpecies,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('EnvironmentalHotspot', record.id, 'CREATE', user, classification, {
      newVersion: record as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_HOTSPOT_DETECTED, record, user);

    this.logger.log(`Environmental hotspot created: ${record.id} (type=${dto.type}, severity=${dto.severity})`);
    return { data: record as EnvironmentalHotspotEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: HotspotFilterDto,
  ): Promise<PaginatedResponse<EnvironmentalHotspotEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.environmentalHotspot.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.environmentalHotspot.count({ where }),
    ]);

    return {
      data: data as EnvironmentalHotspotEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<EnvironmentalHotspotEntity>> {
    const record = await this.prisma.environmentalHotspot.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Environmental hotspot ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record as EnvironmentalHotspotEntity };
  }

  async update(
    id: string,
    dto: UpdateHotspotDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<EnvironmentalHotspotEntity>> {
    const existing = await this.prisma.environmentalHotspot.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Environmental hotspot ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.severity !== undefined) updateData['severity'] = dto.severity;
    if (dto.detectedDate !== undefined) updateData['detectedDate'] = new Date(dto.detectedDate);
    if (dto.satelliteSource !== undefined) updateData['satelliteSource'] = dto.satelliteSource;
    if (dto.affectedSpecies !== undefined) updateData['affectedSpecies'] = dto.affectedSpecies;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.environmentalHotspot.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'EnvironmentalHotspot',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_CLIMATE_HOTSPOT_UPDATED, updated, user);

    this.logger.log(`Environmental hotspot updated: ${id}`);
    return { data: updated as EnvironmentalHotspotEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: HotspotFilterDto,
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
    if (filter.type) where['type'] = filter.type;
    if (filter.severity) where['severity'] = filter.severity;
    if (filter.periodStart || filter.periodEnd) {
      where['detectedDate'] = {
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
    throw new NotFoundException('Environmental hotspot not found');
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
        `Failed to publish ${topic} for environmental hotspot ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
