import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TOPIC_MS_CLIMATE_WATER_STRESS_CREATED,
  TOPIC_MS_CLIMATE_WATER_STRESS_UPDATED,
} from '../kafka-topics.js';
import { AuditService } from './audit.service.js';

const SERVICE_NAME = 'climate-env-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateWaterStressInput {
  geoEntityId: string;
  period: string;
  index: number;
  waterAvailability: string;
  irrigatedAreaPct: number;
  source: string;
  dataClassification?: string;
}

export interface UpdateWaterStressInput {
  geoEntityId?: string;
  period?: string;
  index?: number;
  waterAvailability?: string;
  irrigatedAreaPct?: number;
  source?: string;
  dataClassification?: string;
}

export interface WaterStressFilter {
  geoEntityId?: string;
  period?: string;
  minIndex?: number;
  maxIndex?: number;
}

export class WaterStressService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateWaterStressInput, user: AuthenticatedUser) {
    // Unique constraint: tenant + geoEntityId + period
    const existing = await (this.prisma as any).waterStressIndex.findFirst({
      where: {
        tenantId: user.tenantId,
        geoEntityId: dto.geoEntityId,
        period: dto.period,
      },
    });

    if (existing) {
      throw new HttpError(409, `Water stress index already exists for geoEntity ${dto.geoEntityId} in period ${dto.period}`);
    }

    const classification = dto.dataClassification ?? 'PUBLIC';

    const record = await (this.prisma as any).waterStressIndex.create({
      data: {
        geoEntityId: dto.geoEntityId,
        period: dto.period,
        index: dto.index,
        waterAvailability: dto.waterAvailability,
        irrigatedAreaPct: dto.irrigatedAreaPct,
        source: dto.source,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('WaterStressIndex', record.id, 'CREATE', user, classification as any, {
      newVersion: record,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_WATER_STRESS_CREATED, record, user);

    return { data: record };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: WaterStressFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).waterStressIndex.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).waterStressIndex.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const record = await (this.prisma as any).waterStressIndex.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Water stress index ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record };
  }

  async update(id: string, dto: UpdateWaterStressInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).waterStressIndex.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Water stress index ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.period !== undefined) updateData['period'] = dto.period;
    if (dto.index !== undefined) updateData['index'] = dto.index;
    if (dto.waterAvailability !== undefined) updateData['waterAvailability'] = dto.waterAvailability;
    if (dto.irrigatedAreaPct !== undefined) updateData['irrigatedAreaPct'] = dto.irrigatedAreaPct;
    if (dto.source !== undefined) updateData['source'] = dto.source;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).waterStressIndex.update({
      where: { id },
      data: updateData,
    });

    this.audit.log('WaterStressIndex', updated.id, 'UPDATE', user, (updated.dataClassification ?? 'PUBLIC') as any, {
      previousVersion: existing,
      newVersion: updated,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_WATER_STRESS_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: WaterStressFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.period) where['period'] = filter.period;
    if (filter.minIndex !== undefined || filter.maxIndex !== undefined) {
      where['index'] = {
        ...(filter.minIndex !== undefined && { gte: filter.minIndex }),
        ...(filter.maxIndex !== undefined && { lte: filter.maxIndex }),
      };
    }

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
      correlationId: randomUUID(),
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
