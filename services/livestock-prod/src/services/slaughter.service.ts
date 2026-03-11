import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_LIVESTOCK_SLAUGHTER_CREATED,
  TOPIC_MS_LIVESTOCK_SLAUGHTER_UPDATED,
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
import type { CreateSlaughterInput, UpdateSlaughterInput, SlaughterFilterInput } from '../schemas/slaughter.schema.js';

const SERVICE_NAME = 'livestock-prod-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class SlaughterService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: CreateSlaughterInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new HttpError(400, 'periodEnd must be after periodStart');
    }

    const record = await (this.prisma as any).slaughterRecord.create({
      data: {
        tenantId: user.tenantId,
        speciesId: dto.speciesId,
        facilityId: dto.facilityId,
        count: dto.count,
        condemnations: dto.condemnations ?? 0,
        periodStart,
        periodEnd,
        geoEntityId: dto.geoEntityId,
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_SLAUGHTER_CREATED, record, user);
    console.log(`[SlaughterService] Slaughter record created: ${record.id} count=${record.count}`);

    return { data: record };
  }

  async findAll(
    user: AuthenticatedUser,
    query: SlaughterFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).slaughterRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).slaughterRecord.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const record = await (this.prisma as any).slaughterRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Slaughter record ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      record.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Slaughter record ${id} not found`);
    }

    return { data: record };
  }

  async update(
    id: string,
    dto: UpdateSlaughterInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).slaughterRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Slaughter record ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Slaughter record ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.facilityId !== undefined) updateData['facilityId'] = dto.facilityId;
    if (dto.count !== undefined) updateData['count'] = dto.count;
    if (dto.condemnations !== undefined) updateData['condemnations'] = dto.condemnations;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const record = await (this.prisma as any).slaughterRecord.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_MS_LIVESTOCK_SLAUGHTER_UPDATED, record, user);
    console.log(`[SlaughterService] Slaughter record updated: ${record.id}`);

    return { data: record };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: SlaughterFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.speciesId) where['speciesId'] = query.speciesId;
    if (query.facilityId) where['facilityId'] = query.facilityId;
    if (query.geoEntityId) where['geoEntityId'] = query.geoEntityId;

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
