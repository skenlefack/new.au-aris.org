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
import { CreateCrimeDto } from './dto/create-crime.dto';
import { UpdateCrimeDto } from './dto/update-crime.dto';
import type { CrimeFilterDto } from './dto/crime-filter.dto';
import type { WildlifeCrimeEntity } from './entities/crime.entity';
import {
  TOPIC_MS_WILDLIFE_CRIME_REPORTED,
  TOPIC_MS_WILDLIFE_CRIME_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'wildlife-service';

@Injectable()
export class CrimeService {
  private readonly logger = new Logger(CrimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCrimeDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeCrimeEntity>> {
    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    const crime = await this.prisma.wildlifeCrime.create({
      data: {
        incidentDate: new Date(dto.incidentDate),
        geoEntityId: dto.geoEntityId,
        coordinates: dto.coordinates,
        crimeType: dto.crimeType,
        speciesIds: dto.speciesIds,
        description: dto.description,
        suspectsCount: dto.suspectsCount,
        seizureDescription: dto.seizureDescription,
        seizureQuantity: dto.seizureQuantity,
        seizureUnit: dto.seizureUnit,
        status: dto.status ?? 'reported',
        reportingAgency: dto.reportingAgency,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('WildlifeCrime', crime.id, 'CREATE', user, classification, {
      newVersion: crime as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_CRIME_REPORTED, crime, user);

    this.logger.log(`Wildlife crime reported: ${crime.id} (type=${dto.crimeType})`);
    return { data: crime as WildlifeCrimeEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: CrimeFilterDto,
  ): Promise<PaginatedResponse<WildlifeCrimeEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.wildlifeCrime.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.wildlifeCrime.count({ where }),
    ]);

    return {
      data: data as WildlifeCrimeEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeCrimeEntity>> {
    const crime = await this.prisma.wildlifeCrime.findUnique({
      where: { id },
    });

    if (!crime) {
      throw new NotFoundException(`Wildlife crime ${id} not found`);
    }

    this.verifyTenantAccess(user, crime.tenantId);

    return { data: crime as WildlifeCrimeEntity };
  }

  async update(
    id: string,
    dto: UpdateCrimeDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WildlifeCrimeEntity>> {
    const existing = await this.prisma.wildlifeCrime.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Wildlife crime ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.incidentDate !== undefined) updateData['incidentDate'] = new Date(dto.incidentDate);
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.crimeType !== undefined) updateData['crimeType'] = dto.crimeType;
    if (dto.speciesIds !== undefined) updateData['speciesIds'] = dto.speciesIds;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.suspectsCount !== undefined) updateData['suspectsCount'] = dto.suspectsCount;
    if (dto.seizureDescription !== undefined) updateData['seizureDescription'] = dto.seizureDescription;
    if (dto.seizureQuantity !== undefined) updateData['seizureQuantity'] = dto.seizureQuantity;
    if (dto.seizureUnit !== undefined) updateData['seizureUnit'] = dto.seizureUnit;
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.reportingAgency !== undefined) updateData['reportingAgency'] = dto.reportingAgency;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.wildlifeCrime.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'WildlifeCrime',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_WILDLIFE_CRIME_UPDATED, updated, user);

    this.logger.log(`Wildlife crime updated: ${id}`);
    return { data: updated as WildlifeCrimeEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CrimeFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.crimeType) where['crimeType'] = filter.crimeType;
    if (filter.status) where['status'] = filter.status;
    if (filter.reportingAgency) where['reportingAgency'] = filter.reportingAgency;
    if (filter.periodStart || filter.periodEnd) {
      where['incidentDate'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Wildlife crime not found');
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
        `Failed to publish ${topic} for crime ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
