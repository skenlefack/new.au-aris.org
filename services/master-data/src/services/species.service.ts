import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
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
import type { AuditService } from './audit.service';

const SERVICE_NAME = 'master-data-service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class SpeciesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).species.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `Species with code "${dto.code}" already exists`);
    }

    const entity = await (this.prisma as any).species.create({
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
    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & { category?: string; search?: string },
  ): Promise<PaginatedResponse<any>> {
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
      (this.prisma as any).species.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).species.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const entity = await (this.prisma as any).species.findUnique({ where: { id } });
    if (!entity) {
      throw new HttpError(404, `Species ${id} not found`);
    }
    return { data: entity };
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).species.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Species ${id} not found`);
    }

    const entity = await (this.prisma as any).species.update({
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
    return { data: entity };
  }

  private async publishEvent(
    entity: { id: string; [key: string]: unknown },
    user: AuthUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafka.send(
        TOPIC_SYS_MASTER_SPECIES_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish species event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
