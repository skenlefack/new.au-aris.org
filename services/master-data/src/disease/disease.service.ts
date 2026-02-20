import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TOPIC_SYS_MASTER_DISEASE_UPDATED,
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
import { CreateDiseaseDto } from './dto/create-disease.dto';
import { UpdateDiseaseDto } from './dto/update-disease.dto';
import type { DiseaseRecord } from './entities/disease.entity';

const SERVICE_NAME = 'master-data-service';

@Injectable()
export class DiseaseService {
  private readonly logger = new Logger(DiseaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateDiseaseDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DiseaseRecord>> {
    const existing = await this.prisma.disease.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Disease with code "${dto.code}" already exists`);
    }

    const entity = await this.prisma.disease.create({
      data: {
        code: dto.code,
        nameEn: dto.nameEn,
        nameFr: dto.nameFr,
        isWoahListed: dto.isWoahListed ?? false,
        affectedSpecies: dto.affectedSpecies ?? [],
        isNotifiable: dto.isNotifiable ?? false,
        wahisCategory: dto.wahisCategory ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      entityType: 'Disease',
      entityId: entity.id,
      action: 'CREATE',
      user,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`Disease created: ${entity.code} (${entity.id})`);
    return { data: entity as DiseaseRecord };
  }

  async findAll(
    query: PaginationQuery & { isWoahListed?: boolean; isNotifiable?: boolean; search?: string },
  ): Promise<PaginatedResponse<DiseaseRecord>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { nameEn: 'asc' as const };

    const where: Record<string, unknown> = { isActive: true };
    if (query.isWoahListed !== undefined) where['isWoahListed'] = query.isWoahListed;
    if (query.isNotifiable !== undefined) where['isNotifiable'] = query.isNotifiable;
    if (query.search) {
      where['OR'] = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { nameFr: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.disease.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.disease.count({ where }),
    ]);

    return {
      data: data as DiseaseRecord[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<DiseaseRecord>> {
    const entity = await this.prisma.disease.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Disease ${id} not found`);
    }
    return { data: entity as DiseaseRecord };
  }

  async update(
    id: string,
    dto: UpdateDiseaseDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DiseaseRecord>> {
    const existing = await this.prisma.disease.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Disease ${id} not found`);
    }

    const entity = await this.prisma.disease.update({
      where: { id },
      data: {
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.isWoahListed !== undefined && { isWoahListed: dto.isWoahListed }),
        ...(dto.affectedSpecies !== undefined && { affectedSpecies: dto.affectedSpecies }),
        ...(dto.isNotifiable !== undefined && { isNotifiable: dto.isNotifiable }),
        ...(dto.wahisCategory !== undefined && { wahisCategory: dto.wahisCategory }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        version: { increment: 1 },
      },
    });

    await this.audit.log({
      entityType: 'Disease',
      entityId: entity.id,
      action: 'UPDATE',
      user,
      reason: dto.reason,
      previousVersion: existing as unknown as object,
      newVersion: entity as unknown as object,
      dataClassification: 'PUBLIC',
    });

    await this.publishEvent(entity, user);
    this.logger.log(`Disease updated: ${entity.code} (${entity.id}) v${entity.version}`);
    return { data: entity as DiseaseRecord };
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
        TOPIC_SYS_MASTER_DISEASE_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish disease event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
