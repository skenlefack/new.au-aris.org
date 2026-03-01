import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
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
import type { AuditService } from './audit.service';

const SERVICE_NAME = 'master-data-service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class DiseaseService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).disease.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpError(409, `Disease with code "${dto.code}" already exists`);
    }

    const entity = await (this.prisma as any).disease.create({
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
    return { data: entity };
  }

  async findAll(
    query: PaginationQuery & { isWoahListed?: boolean; isNotifiable?: boolean; search?: string },
  ): Promise<PaginatedResponse<any>> {
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
      (this.prisma as any).disease.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).disease.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const entity = await (this.prisma as any).disease.findUnique({ where: { id } });
    if (!entity) {
      throw new HttpError(404, `Disease ${id} not found`);
    }
    return { data: entity };
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).disease.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Disease ${id} not found`);
    }

    const entity = await (this.prisma as any).disease.update({
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
        TOPIC_SYS_MASTER_DISEASE_UPDATED,
        entity.id as string,
        entity,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish disease event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
