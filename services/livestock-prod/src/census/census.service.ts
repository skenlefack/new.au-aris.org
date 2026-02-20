import {
  Injectable,
  NotFoundException,
  ConflictException,
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
import { CreateCensusDto } from './dto/create-census.dto';
import { UpdateCensusDto } from './dto/update-census.dto';
import type { CensusFilterDto } from './dto/census-filter.dto';
import type { LivestockCensusEntity } from './entities/census.entity';
import {
  TOPIC_MS_LIVESTOCK_CENSUS_CREATED,
  TOPIC_MS_LIVESTOCK_CENSUS_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'livestock-prod-service';

@Injectable()
export class CensusService {
  private readonly logger = new Logger(CensusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCensusDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LivestockCensusEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    // Business rule: unique constraint per tenant+geo+species+year
    const existing = await this.prisma.livestockCensus.findFirst({
      where: {
        tenantId: user.tenantId,
        geoEntityId: dto.geoEntityId,
        speciesId: dto.speciesId,
        year: dto.year,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Census record already exists for tenant=${user.tenantId}, geo=${dto.geoEntityId}, species=${dto.speciesId}, year=${dto.year}`,
      );
    }

    const census = await this.prisma.livestockCensus.create({
      data: {
        geoEntityId: dto.geoEntityId,
        speciesId: dto.speciesId,
        year: dto.year,
        population: dto.population,
        methodology: dto.methodology,
        source: dto.source,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('LivestockCensus', census.id, 'CREATE', user, classification, {
      newVersion: census as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_CENSUS_CREATED, census, user);

    this.logger.log(`Census record created: ${census.id} (species=${dto.speciesId}, year=${dto.year})`);
    return { data: census as LivestockCensusEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: CensusFilterDto,
  ): Promise<PaginatedResponse<LivestockCensusEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.livestockCensus.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.livestockCensus.count({ where }),
    ]);

    return {
      data: data as LivestockCensusEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LivestockCensusEntity>> {
    const census = await this.prisma.livestockCensus.findUnique({
      where: { id },
    });

    if (!census) {
      throw new NotFoundException(`Census record ${id} not found`);
    }

    this.verifyTenantAccess(user, census.tenantId);

    return { data: census as LivestockCensusEntity };
  }

  async update(
    id: string,
    dto: UpdateCensusDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LivestockCensusEntity>> {
    const existing = await this.prisma.livestockCensus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Census record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.year !== undefined) updateData['year'] = dto.year;
    if (dto.population !== undefined) updateData['population'] = dto.population;
    if (dto.methodology !== undefined) updateData['methodology'] = dto.methodology;
    if (dto.source !== undefined) updateData['source'] = dto.source;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.livestockCensus.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'LivestockCensus',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_LIVESTOCK_CENSUS_UPDATED, updated, user);

    this.logger.log(`Census record updated: ${id}`);
    return { data: updated as LivestockCensusEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CensusFilterDto,
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
    if (filter.year) where['year'] = filter.year;
    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.periodStart || filter.periodEnd) {
      where['createdAt'] = {
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
    throw new NotFoundException('Census record not found');
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
        `Failed to publish ${topic} for census ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
