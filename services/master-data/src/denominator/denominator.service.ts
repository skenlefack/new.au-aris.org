import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_SYS_MASTER_DENOMINATOR_UPDATED,
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
import { CreateDenominatorDto } from './dto/create-denominator.dto';
import { UpdateDenominatorDto } from './dto/update-denominator.dto';
import type { DenominatorRecord } from './entities/denominator.entity';

const SERVICE_NAME = 'master-data-service';

@Injectable()
export class DenominatorService {
  private readonly logger = new Logger(DenominatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateDenominatorDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DenominatorRecord>> {
    // Verify species exists
    const species = await this.prisma.species.findUnique({
      where: { id: dto.speciesId },
    });
    if (!species) {
      throw new NotFoundException(`Species ${dto.speciesId} not found`);
    }

    // Check for existing denominator with same composite key
    const existing = await this.prisma.denominator.findFirst({
      where: {
        countryCode: dto.countryCode,
        speciesId: dto.speciesId,
        year: dto.year,
        source: dto.source,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Denominator already exists for ${dto.countryCode}/${species.code}/${dto.year}/${dto.source}`,
      );
    }

    // Verify geoEntity if provided
    if (dto.geoEntityId) {
      const geoEntity = await this.prisma.geoEntity.findUnique({
        where: { id: dto.geoEntityId },
      });
      if (!geoEntity) {
        throw new NotFoundException(`GeoEntity ${dto.geoEntityId} not found`);
      }
    }

    const entity = await this.prisma.denominator.create({
      data: {
        countryCode: dto.countryCode,
        geoEntityId: dto.geoEntityId ?? null,
        speciesId: dto.speciesId,
        year: dto.year,
        source: dto.source,
        population: BigInt(dto.population),
        assumptions: dto.assumptions ?? null,
      },
    });

    await this.audit.log({
      entityType: 'Denominator',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: this.serializeDenominator(entity),
      dataClassification: 'PARTNER',
    });

    await this.publishEvent(entity, user);
    this.logger.log(
      `Denominator created: ${dto.countryCode}/${species.code}/${dto.year} (${entity.id})`,
    );
    return { data: entity as unknown as DenominatorRecord };
  }

  async findAll(
    query: PaginationQuery & {
      countryCode?: string;
      speciesId?: string;
      year?: number;
      source?: string;
    },
  ): Promise<PaginatedResponse<DenominatorRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { year: 'desc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.countryCode) where['countryCode'] = query.countryCode;
    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.year) where['year'] = query.year;
    if (query.source) where['source'] = query.source;

    const [data, total] = await Promise.all([
      this.prisma.denominator.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.denominator.count({ where }),
    ]);

    return {
      data: data as unknown as DenominatorRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<DenominatorRecord>> {
    const entity = await this.prisma.denominator.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Denominator ${id} not found`);
    }
    return { data: entity as unknown as DenominatorRecord };
  }

  async update(
    id: string,
    dto: UpdateDenominatorDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DenominatorRecord>> {
    const existing = await this.prisma.denominator.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Denominator ${id} not found`);
    }

    const entity = await this.prisma.denominator.update({
      where: { id },
      data: {
        ...(dto.population !== undefined && { population: BigInt(dto.population) }),
        ...(dto.assumptions !== undefined && { assumptions: dto.assumptions }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Denominator',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: this.serializeDenominator(existing),
      newVersion: this.serializeDenominator(entity),
      dataClassification: 'PARTNER',
    });

    await this.publishEvent(entity, user);
    this.logger.log(
      `Denominator updated: ${entity.countryCode}/${entity.year} (${entity.id}) v${entity.version}`,
    );
    return { data: entity as unknown as DenominatorRecord };
  }

  async validate(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DenominatorRecord>> {
    const existing = await this.prisma.denominator.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Denominator ${id} not found`);
    }

    const entity = await this.prisma.denominator.update({
      where: { id },
      data: {
        validatedAt: new Date(),
        validatedBy: user.userId,
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Denominator',
      entityId: entity.id,
      action: 'VALIDATE',
      user,
      previousVersion: this.serializeDenominator(existing),
      newVersion: this.serializeDenominator(entity),
      dataClassification: 'PARTNER',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`Denominator validated: ${entity.id} v${entity.version}`);
    return { data: entity as unknown as DenominatorRecord };
  }

  private serializeDenominator(entity: { population: bigint; [key: string]: unknown }): object {
    return { ...entity, population: entity.population.toString() };
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
        TOPIC_SYS_MASTER_DENOMINATOR_UPDATED,
        entity.id as string,
        this.serializeDenominator(entity as { population: bigint; [key: string]: unknown }),
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish denominator event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
