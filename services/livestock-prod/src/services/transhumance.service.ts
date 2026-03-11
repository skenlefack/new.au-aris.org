import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_LIVESTOCK_TRANSHUMANCE_CREATED,
  TOPIC_MS_LIVESTOCK_TRANSHUMANCE_UPDATED,
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
import type { CreateTranshumanceInput, UpdateTranshumanceInput, TranshumanceFilterInput } from '../schemas/transhumance.schema.js';

const SERVICE_NAME = 'livestock-prod-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TranshumanceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreateTranshumanceInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const corridor = await (this.prisma as any).transhumanceCorridor.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        route: dto.route as Prisma.InputJsonValue,
        speciesId: dto.speciesId,
        seasonality: dto.seasonality,
        crossBorder: dto.crossBorder ?? false,
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_TRANSHUMANCE_CREATED, corridor, user);
    console.log(`[TranshumanceService] Corridor created: ${corridor.id} name=${corridor.name}`);

    return { data: corridor };
  }

  async findAll(
    user: AuthenticatedUser,
    query: TranshumanceFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).transhumanceCorridor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).transhumanceCorridor.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const corridor = await (this.prisma as any).transhumanceCorridor.findUnique({
      where: { id },
    });

    if (!corridor) {
      throw new HttpError(404, `Transhumance corridor ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      corridor.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Transhumance corridor ${id} not found`);
    }

    return { data: corridor };
  }

  async update(
    id: string,
    dto: UpdateTranshumanceInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).transhumanceCorridor.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Transhumance corridor ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Transhumance corridor ${id} not found`);
    }

    const corridor = await (this.prisma as any).transhumanceCorridor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.route !== undefined && { route: dto.route as Prisma.InputJsonValue }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.seasonality !== undefined && { seasonality: dto.seasonality }),
        ...(dto.crossBorder !== undefined && { crossBorder: dto.crossBorder }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_TRANSHUMANCE_UPDATED, corridor, user);
    console.log(`[TranshumanceService] Corridor updated: ${corridor.id}`);

    return { data: corridor };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: TranshumanceFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.crossBorder !== undefined) where['crossBorder'] = query.crossBorder;
    if (query.speciesId) where['speciesId'] = query.speciesId;

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
