import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_FISHERIES_EFFORT_CREATED,
  TOPIC_MS_FISHERIES_EFFORT_UPDATED,
  TOPIC_MS_FISHERIES_EFFORT_DELETED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'fisheries-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class EffortService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: {
      effortType: string;
      effortValue: number;
      effortUnit: string;
      startDate?: string;
      endDate?: string;
      gearType: string;
      vesselId?: string;
      captureId?: string;
      crewSize?: number;
      faoAreaCode?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const effort = await (this.prisma as any).fishingEffort.create({
      data: {
        tenantId: user.tenantId,
        effortType: dto.effortType,
        effortValue: dto.effortValue,
        effortUnit: dto.effortUnit,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        gearType: dto.gearType,
        vesselId: dto.vesselId ?? null,
        captureId: dto.captureId ?? null,
        crewSize: dto.crewSize ?? null,
        faoAreaCode: dto.faoAreaCode ?? null,
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_EFFORT_CREATED, { id: effort.id, ...effort }, user);

    return { data: effort };
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      effortType?: string;
      gearType?: string;
      vesselId?: string;
      captureId?: string;
      faoAreaCode?: string;
    },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).fishingEffort.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).fishingEffort.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const effort = await (this.prisma as any).fishingEffort.findUnique({ where: { id } });

    if (!effort) {
      throw new HttpError(404, `Fishing effort ${id} not found`);
    }

    this.verifyTenantAccess(user, effort.tenantId);

    return { data: effort };
  }

  async update(
    id: string,
    dto: {
      effortType?: string;
      effortValue?: number;
      effortUnit?: string;
      startDate?: string;
      endDate?: string;
      gearType?: string;
      vesselId?: string;
      captureId?: string;
      crewSize?: number;
      faoAreaCode?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).fishingEffort.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, `Fishing effort ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const effort = await (this.prisma as any).fishingEffort.update({
      where: { id },
      data: {
        ...(dto.effortType !== undefined && { effortType: dto.effortType }),
        ...(dto.effortValue !== undefined && { effortValue: dto.effortValue }),
        ...(dto.effortUnit !== undefined && { effortUnit: dto.effortUnit }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.gearType !== undefined && { gearType: dto.gearType }),
        ...(dto.vesselId !== undefined && { vesselId: dto.vesselId }),
        ...(dto.captureId !== undefined && { captureId: dto.captureId }),
        ...(dto.crewSize !== undefined && { crewSize: dto.crewSize }),
        ...(dto.faoAreaCode !== undefined && { faoAreaCode: dto.faoAreaCode }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_EFFORT_UPDATED, { id: effort.id, ...effort }, user);

    return { data: effort };
  }

  async delete(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).fishingEffort.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, `Fishing effort ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    await (this.prisma as any).fishingEffort.delete({ where: { id } });

    await this.publishEvent(TOPIC_MS_FISHERIES_EFFORT_DELETED, { id, tenantId: existing.tenantId }, user);

    return { data: { id, deleted: true } };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: { effortType?: string; gearType?: string; vesselId?: string; captureId?: string; faoAreaCode?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.effortType) where['effortType'] = query.effortType;
    if (query.gearType) where['gearType'] = query.gearType;
    if (query.vesselId) where['vesselId'] = query.vesselId;
    if (query.captureId) where['captureId'] = query.captureId;
    if (query.faoAreaCode) where['faoAreaCode'] = query.faoAreaCode;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new HttpError(404, 'Resource not found');
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
      console.error(`Failed to publish ${topic}`, error);
    }
  }
}
