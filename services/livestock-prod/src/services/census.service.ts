import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_LIVESTOCK_CENSUS_CREATED,
  TOPIC_MS_LIVESTOCK_CENSUS_UPDATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { CreateCensusInput, UpdateCensusInput, CensusFilterInput } from '../schemas/census.schema.js';

const SERVICE_NAME = 'livestock-prod-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class CensusService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreateCensusInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const census = await (this.prisma as any).livestockCensus.create({
      data: {
        tenantId: user.tenantId,
        geoEntityId: dto.geoEntityId,
        speciesId: dto.speciesId,
        year: dto.year,
        population: dto.population,
        methodology: dto.methodology,
        source: dto.source,
        dataClassification: dto.dataClassification ?? 'PUBLIC',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_CENSUS_CREATED, census, user);
    console.log(`[CensusService] Census created: ${census.id} year=${census.year}`);

    return { data: census };
  }

  async findAll(
    user: AuthenticatedUser,
    query: CensusFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).livestockCensus.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).livestockCensus.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const census = await (this.prisma as any).livestockCensus.findUnique({
      where: { id },
    });

    if (!census) {
      throw new HttpError(404, `Census ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      census.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Census ${id} not found`);
    }

    return { data: census };
  }

  async update(
    id: string,
    dto: UpdateCensusInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).livestockCensus.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Census ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Census ${id} not found`);
    }

    const census = await (this.prisma as any).livestockCensus.update({
      where: { id },
      data: {
        ...(dto.geoEntityId !== undefined && { geoEntityId: dto.geoEntityId }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.population !== undefined && { population: dto.population }),
        ...(dto.methodology !== undefined && { methodology: dto.methodology }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_CENSUS_UPDATED, census, user);
    console.log(`[CensusService] Census updated: ${census.id}`);

    return { data: census };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: CensusFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.geoEntityId) where['geoEntityId'] = query.geoEntityId;
    if (query.year) where['year'] = query.year;

    return where;
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
      await this.kafka.send(topic, payload.id, payload, headers);
    } catch (error) {
      console.error(
        `Failed to publish ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
