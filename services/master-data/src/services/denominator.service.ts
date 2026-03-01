import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
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
import type { AuditService } from './audit.service';

const SERVICE_NAME = 'master-data-service';

interface AuthUser { userId: string; role: string; tenantId: string; tenantLevel: string }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class DenominatorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    // Verify species exists
    const species = await (this.prisma as any).species.findUnique({
      where: { id: dto.speciesId },
    });
    if (!species) {
      throw new HttpError(404, `Species ${dto.speciesId} not found`);
    }

    // Check for existing denominator with same composite key
    const existing = await (this.prisma as any).denominator.findFirst({
      where: {
        countryCode: dto.countryCode,
        speciesId: dto.speciesId,
        year: dto.year,
        source: dto.source,
      },
    });
    if (existing) {
      throw new HttpError(
        409,
        `Denominator already exists for ${dto.countryCode}/${species.code}/${dto.year}/${dto.source}`,
      );
    }

    // Verify geoEntity if provided
    if (dto.geoEntityId) {
      const geoEntity = await (this.prisma as any).geoEntity.findUnique({
        where: { id: dto.geoEntityId },
      });
      if (!geoEntity) {
        throw new HttpError(404, `GeoEntity ${dto.geoEntityId} not found`);
      }
    }

    const entity = await (this.prisma as any).denominator.create({
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
    return { data: entity as unknown };
  }

  async findAll(
    query: PaginationQuery & {
      countryCode?: string;
      speciesId?: string;
      year?: number;
      source?: string;
    },
  ): Promise<PaginatedResponse<any>> {
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
      (this.prisma as any).denominator.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).denominator.count({ where }),
    ]);

    return { data: data as unknown[], meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const entity = await (this.prisma as any).denominator.findUnique({ where: { id } });
    if (!entity) {
      throw new HttpError(404, `Denominator ${id} not found`);
    }
    return { data: entity as unknown };
  }

  async update(id: string, dto: any, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).denominator.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Denominator ${id} not found`);
    }

    const entity = await (this.prisma as any).denominator.update({
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
    return { data: entity as unknown };
  }

  async validate(id: string, user: AuthUser): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).denominator.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Denominator ${id} not found`);
    }

    const entity = await (this.prisma as any).denominator.update({
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
    return { data: entity as unknown };
  }

  private serializeDenominator(entity: { population: bigint; [key: string]: unknown }): object {
    return { ...entity, population: entity.population.toString() };
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
        TOPIC_SYS_MASTER_DENOMINATOR_UPDATED,
        entity.id as string,
        this.serializeDenominator(entity as unknown as { population: bigint; [key: string]: unknown }),
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish denominator event for ${entity.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
