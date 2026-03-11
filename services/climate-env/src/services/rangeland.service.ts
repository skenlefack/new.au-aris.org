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
  TOPIC_MS_CLIMATE_RANGELAND_ASSESSED,
  TOPIC_MS_CLIMATE_RANGELAND_UPDATED,
} from '../kafka-topics.js';
import { AuditService } from './audit.service.js';

const SERVICE_NAME = 'climate-env-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateRangelandInput {
  geoEntityId: string;
  assessmentDate: string;
  ndviIndex: number;
  biomassTonsPerHa: number;
  degradationLevel: string;
  carryingCapacity: number;
  dataClassification?: string;
}

export interface UpdateRangelandInput {
  geoEntityId?: string;
  assessmentDate?: string;
  ndviIndex?: number;
  biomassTonsPerHa?: number;
  degradationLevel?: string;
  carryingCapacity?: number;
  dataClassification?: string;
}

export interface RangelandFilter {
  geoEntityId?: string;
  degradationLevel?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class RangelandService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateRangelandInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PUBLIC';

    const record = await (this.prisma as any).rangelandCondition.create({
      data: {
        geoEntityId: dto.geoEntityId,
        assessmentDate: new Date(dto.assessmentDate),
        ndviIndex: dto.ndviIndex,
        biomassTonsPerHa: dto.biomassTonsPerHa,
        degradationLevel: dto.degradationLevel,
        carryingCapacity: dto.carryingCapacity,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('RangelandCondition', record.id, 'CREATE', user, classification as any, {
      newVersion: record,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_RANGELAND_ASSESSED, record, user);

    return { data: record };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: RangelandFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).rangelandCondition.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).rangelandCondition.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const record = await (this.prisma as any).rangelandCondition.findUnique({
      where: { id },
    });

    if (!record) {
      throw new HttpError(404, `Rangeland condition ${id} not found`);
    }

    this.verifyTenantAccess(user, record.tenantId);

    return { data: record };
  }

  async update(id: string, dto: UpdateRangelandInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).rangelandCondition.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Rangeland condition ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.assessmentDate !== undefined) updateData['assessmentDate'] = new Date(dto.assessmentDate);
    if (dto.ndviIndex !== undefined) updateData['ndviIndex'] = dto.ndviIndex;
    if (dto.biomassTonsPerHa !== undefined) updateData['biomassTonsPerHa'] = dto.biomassTonsPerHa;
    if (dto.degradationLevel !== undefined) updateData['degradationLevel'] = dto.degradationLevel;
    if (dto.carryingCapacity !== undefined) updateData['carryingCapacity'] = dto.carryingCapacity;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).rangelandCondition.update({
      where: { id },
      data: updateData,
    });

    this.audit.log('RangelandCondition', updated.id, 'UPDATE', user, (updated.dataClassification ?? 'PUBLIC') as any, {
      previousVersion: existing,
      newVersion: updated,
    });

    await this.publishEvent(TOPIC_MS_CLIMATE_RANGELAND_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: RangelandFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.degradationLevel) where['degradationLevel'] = filter.degradationLevel;
    if (filter.periodStart || filter.periodEnd) {
      where['assessmentDate'] = {
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
