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
  TOPIC_MS_CLIMATE_DATA_RECORDED,
  TOPIC_MS_CLIMATE_DATA_UPDATED,
} from '../kafka-topics.js';
import { AuditService } from './audit.service.js';

const SERVICE_NAME = 'climate-env-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateClimateDataInput {
  geoEntityId: string;
  date: string;
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  source: string;
  dataClassification?: string;
}

export interface UpdateClimateDataInput {
  geoEntityId?: string;
  date?: string;
  temperature?: number;
  rainfall?: number;
  humidity?: number;
  windSpeed?: number;
  source?: string;
  dataClassification?: string;
}

export interface ClimateDataFilter {
  geoEntityId?: string;
  source?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class ClimateDataService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateClimateDataInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PUBLIC';

    const record = await (this.prisma as any).climateDataPoint.create({
      data: {
        geoEntityId: dto.geoEntityId,
        date: new Date(dto.date),
        temperature: dto.temperature,
        rainfall: dto.rainfall,
        humidity: dto.humidity,
        windSpeed: dto.windSpeed,
        source: dto.source,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('ClimateDataPoint', record.id, 'CREATE', user, classification as any, {
      newVersion: record,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_DATA_RECORDED, record, user);

    return { data: record };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: ClimateDataFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).climateDataPoint.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).climateDataPoint.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const record = await (this.prisma as any).climateDataPoint.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Climate data point ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record };
  }

  async update(id: string, dto: UpdateClimateDataInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).climateDataPoint.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Climate data point ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.date !== undefined) updateData['date'] = new Date(dto.date);
    if (dto.temperature !== undefined) updateData['temperature'] = dto.temperature;
    if (dto.rainfall !== undefined) updateData['rainfall'] = dto.rainfall;
    if (dto.humidity !== undefined) updateData['humidity'] = dto.humidity;
    if (dto.windSpeed !== undefined) updateData['windSpeed'] = dto.windSpeed;
    if (dto.source !== undefined) updateData['source'] = dto.source;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).climateDataPoint.update({
      where: { id },
      data: updateData,
    });

    this.audit.log('ClimateDataPoint', updated.id, 'UPDATE', user, (updated.dataClassification ?? 'PUBLIC') as any, {
      previousVersion: existing,
      newVersion: updated,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_DATA_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: ClimateDataFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.source) where['source'] = filter.source;
    if (filter.periodStart || filter.periodEnd) {
      where['date'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
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
