import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_SYS_MASTER_GEO_UPDATED,
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
import { AuditService } from '../audit/audit.service';
import { CreateGeoEntityDto } from './dto/create-geo-entity.dto';
import { UpdateGeoEntityDto } from './dto/update-geo-entity.dto';
import type { GeoEntityRecord } from './entities/geo-entity.entity';

const SERVICE_NAME = 'master-data-service';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateGeoEntityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<GeoEntityRecord>> {
    const existing = await this.prisma.geoEntity.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`GeoEntity with code "${dto.code}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.geoEntity.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent GeoEntity ${dto.parentId} not found`);
      }
    }

    const entity = await this.prisma.geoEntity.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        level: dto.level,
        parentId: dto.parentId ?? null,
        countryCode: dto.countryCode,
        centroidLat: dto.centroidLat ?? null,
        centroidLng: dto.centroidLng ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'GeoEntity',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`GeoEntity created: ${entity.code} (${entity.id})`);
    return { data: entity as GeoEntityRecord };
  }

  async findAll(
    query: PaginationQuery & {
      level?: string;
      countryCode?: string;
      parentId?: string;
      search?: string;
    },
  ): Promise<PaginatedResponse<GeoEntityRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { code: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.level) where['level'] = query.level;
    if (query.countryCode) where['countryCode'] = query.countryCode;
    if (query.parentId) where['parentId'] = query.parentId;
    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.geoEntity.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.geoEntity.count({ where }),
    ]);

    return {
      data: data as GeoEntityRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<GeoEntityRecord>> {
    const entity = await this.prisma.geoEntity.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`GeoEntity ${id} not found`);
    }
    return { data: entity as GeoEntityRecord };
  }

  async findByCode(code: string): Promise<ApiResponse<GeoEntityRecord>> {
    const entity = await this.prisma.geoEntity.findUnique({ where: { code } });
    if (!entity) {
      throw new NotFoundException(`GeoEntity with code "${code}" not found`);
    }
    return { data: entity as GeoEntityRecord };
  }

  async update(
    id: string,
    dto: UpdateGeoEntityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<GeoEntityRecord>> {
    const existing = await this.prisma.geoEntity.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`GeoEntity ${id} not found`);
    }

    const entity = await this.prisma.geoEntity.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.centroidLat !== undefined && { centroidLat: dto.centroidLat }),
        ...(dto.centroidLng !== undefined && { centroidLng: dto.centroidLng }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'GeoEntity',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`GeoEntity updated: ${entity.code} (${entity.id}) v${entity.version}`);
    return { data: entity as GeoEntityRecord };
  }

  async findChildren(
    parentId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<GeoEntityRecord>> {
    const parent = await this.prisma.geoEntity.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new NotFoundException(`GeoEntity ${parentId} not found`);
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { parentId, isActive: true };

    const [data, total] = await Promise.all([
      this.prisma.geoEntity.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.geoEntity.count({ where }),
    ]);

    return {
      data: data as GeoEntityRecord[],
      meta: { total, page, limit },
    };
  }

  private async publishEvent(
    entity: { id: string; [key: string]: unknown },
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
      await this.kafkaProducer.send(
        TOPIC_SYS_MASTER_GEO_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish geo event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
