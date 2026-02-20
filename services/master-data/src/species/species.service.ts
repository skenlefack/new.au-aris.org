import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_SYS_MASTER_SPECIES_UPDATED,
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
import { CreateSpeciesDto } from './dto/create-species.dto';
import { UpdateSpeciesDto } from './dto/update-species.dto';
import type { SpeciesRecord } from './entities/species.entity';

const SERVICE_NAME = 'master-data-service';

@Injectable()
export class SpeciesService {
  private readonly logger = new Logger(SpeciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateSpeciesDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SpeciesRecord>> {
    const existing = await this.prisma.species.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Species with code "${dto.code}" already exists`);
    }

    const entity = await this.prisma.species.create({
      data: {
        code: dto.code,
        scientificName: dto.scientificName,
        commonNameEn: dto.commonNameEn,
        commonNameFr: dto.commonNameFr,
        category: dto.category,
        productionCategories: dto.productionCategories ?? [],
        isWoahListed: dto.isWoahListed ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Species',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`Species created: ${entity.code} (${entity.id})`);
    return { data: entity as SpeciesRecord };
  }

  async findAll(
    query: PaginationQuery & { category?: string; search?: string },
  ): Promise<PaginatedResponse<SpeciesRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { commonNameEn: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.category) where['category'] = query.category;
    if (query.search) {
      where['OR'] = [
        { commonNameEn: { contains: query.search, mode: 'insensitive' } },
        { scientificName: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.species.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.species.count({ where }),
    ]);

    return {
      data: data as SpeciesRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<SpeciesRecord>> {
    const entity = await this.prisma.species.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Species ${id} not found`);
    }
    return { data: entity as SpeciesRecord };
  }

  async update(
    id: string,
    dto: UpdateSpeciesDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SpeciesRecord>> {
    const existing = await this.prisma.species.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Species ${id} not found`);
    }

    const entity = await this.prisma.species.update({
      where: { id },
      data: {
        ...(dto.scientificName !== undefined && { scientificName: dto.scientificName }),
        ...(dto.commonNameEn !== undefined && { commonNameEn: dto.commonNameEn }),
        ...(dto.commonNameFr !== undefined && { commonNameFr: dto.commonNameFr }),
        ...(dto.productionCategories !== undefined && { productionCategories: dto.productionCategories }),
        ...(dto.isWoahListed !== undefined && { isWoahListed: dto.isWoahListed }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Species',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`Species updated: ${entity.code} (${entity.id}) v${entity.version}`);
    return { data: entity as SpeciesRecord };
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
        TOPIC_SYS_MASTER_SPECIES_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish species event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
