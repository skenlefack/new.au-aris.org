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
import { CreateApiaryDto } from './dto/create-apiary.dto';
import { UpdateApiaryDto } from './dto/update-apiary.dto';
import type { ApiaryFilterDto } from './dto/apiary-filter.dto';
import type { ApiaryEntity } from './entities/apiary.entity';
import {
  TOPIC_MS_APICULTURE_APIARY_CREATED,
  TOPIC_MS_APICULTURE_APIARY_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

@Injectable()
export class ApiaryService {
  private readonly logger = new Logger(ApiaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateApiaryDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ApiaryEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const apiary = await this.prisma.apiary.create({
      data: {
        name: dto.name,
        geoEntityId: dto.geoEntityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        hiveCount: dto.hiveCount,
        hiveType: dto.hiveType,
        ownerName: dto.ownerName,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('Apiary', apiary.id, 'CREATE', user, classification, {
      newVersion: apiary as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_APIARY_CREATED, apiary, user);

    this.logger.log(`Apiary created: ${apiary.id} (name=${dto.name})`);
    return { data: apiary as ApiaryEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: ApiaryFilterDto,
  ): Promise<PaginatedResponse<ApiaryEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.apiary.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.apiary.count({ where }),
    ]);

    return {
      data: data as ApiaryEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ApiaryEntity>> {
    const apiary = await this.prisma.apiary.findUnique({
      where: { id },
    });

    if (!apiary) {
      throw new NotFoundException(`Apiary ${id} not found`);
    }

    this.verifyTenantAccess(user, apiary.tenantId);

    return { data: apiary as ApiaryEntity };
  }

  async update(
    id: string,
    dto: UpdateApiaryDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ApiaryEntity>> {
    const existing = await this.prisma.apiary.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Apiary ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.latitude !== undefined) updateData['latitude'] = dto.latitude;
    if (dto.longitude !== undefined) updateData['longitude'] = dto.longitude;
    if (dto.hiveCount !== undefined) updateData['hiveCount'] = dto.hiveCount;
    if (dto.hiveType !== undefined) updateData['hiveType'] = dto.hiveType;
    if (dto.ownerName !== undefined) updateData['ownerName'] = dto.ownerName;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.apiary.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'Apiary',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_APIARY_UPDATED, updated, user);

    this.logger.log(`Apiary updated: ${id}`);
    return { data: updated as ApiaryEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: ApiaryFilterDto,
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

    if (filter.hiveType) where['hiveType'] = filter.hiveType;
    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Apiary not found');
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
        `Failed to publish ${topic} for apiary ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
