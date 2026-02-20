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
import { CreateProtectedAreaDto } from './dto/create-protected-area.dto';
import { UpdateProtectedAreaDto } from './dto/update-protected-area.dto';
import type { ProtectedAreaFilterDto } from './dto/protected-area-filter.dto';
import type { ProtectedAreaEntity } from './entities/protected-area.entity';
import {
  TOPIC_MS_WILDLIFE_PROTECTED_AREA_CREATED,
  TOPIC_MS_WILDLIFE_PROTECTED_AREA_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'wildlife-service';

@Injectable()
export class ProtectedAreaService {
  private readonly logger = new Logger(ProtectedAreaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateProtectedAreaDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ProtectedAreaEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const area = await this.prisma.protectedArea.create({
      data: {
        name: dto.name,
        wdpaId: dto.wdpaId,
        iucnCategory: dto.iucnCategory,
        geoEntityId: dto.geoEntityId,
        areaKm2: dto.areaKm2,
        designationDate: dto.designationDate ? new Date(dto.designationDate) : undefined,
        managingAuthority: dto.managingAuthority,
        coordinates: dto.coordinates,
        isActive: dto.isActive ?? true,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('ProtectedArea', area.id, 'CREATE', user, classification, {
      newVersion: area as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_PROTECTED_AREA_CREATED, area, user);

    this.logger.log(`Protected area created: ${area.id} (${dto.name})`);
    return { data: area as ProtectedAreaEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: ProtectedAreaFilterDto,
  ): Promise<PaginatedResponse<ProtectedAreaEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.protectedArea.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.protectedArea.count({ where }),
    ]);

    return {
      data: data as ProtectedAreaEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ProtectedAreaEntity>> {
    const area = await this.prisma.protectedArea.findUnique({
      where: { id },
    });

    if (!area) {
      throw new NotFoundException(`Protected area ${id} not found`);
    }

    this.verifyTenantAccess(user, area.tenantId);

    return { data: area as ProtectedAreaEntity };
  }

  async update(
    id: string,
    dto: UpdateProtectedAreaDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<ProtectedAreaEntity>> {
    const existing = await this.prisma.protectedArea.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Protected area ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.wdpaId !== undefined) updateData['wdpaId'] = dto.wdpaId;
    if (dto.iucnCategory !== undefined) updateData['iucnCategory'] = dto.iucnCategory;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.areaKm2 !== undefined) updateData['areaKm2'] = dto.areaKm2;
    if (dto.designationDate !== undefined) updateData['designationDate'] = new Date(dto.designationDate);
    if (dto.managingAuthority !== undefined) updateData['managingAuthority'] = dto.managingAuthority;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.protectedArea.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'ProtectedArea',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_WILDLIFE_PROTECTED_AREA_UPDATED, updated, user);

    this.logger.log(`Protected area updated: ${id}`);
    return { data: updated as ProtectedAreaEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: ProtectedAreaFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.iucnCategory) where['iucnCategory'] = filter.iucnCategory;
    if (filter.managingAuthority) where['managingAuthority'] = filter.managingAuthority;
    if (filter.isActive !== undefined) where['isActive'] = filter.isActive;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Protected area not found');
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
        `Failed to publish ${topic} for protected area ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
