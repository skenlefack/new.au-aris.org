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
import { AuditService } from './audit.service.js';
import {
  TOPIC_MS_GOVERNANCE_CAPACITY_CREATED,
  TOPIC_MS_GOVERNANCE_CAPACITY_UPDATED,
} from '../kafka-topics.js';

const SERVICE_NAME = 'governance-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateCapacityInput {
  year: number;
  organizationName: string;
  staffCount: number;
  budgetUsd: number;
  pvsSelfAssessmentScore?: number;
  oieStatus?: string;
  dataClassification?: string;
}

export interface UpdateCapacityInput {
  year?: number;
  organizationName?: string;
  staffCount?: number;
  budgetUsd?: number;
  pvsSelfAssessmentScore?: number;
  oieStatus?: string;
  dataClassification?: string;
}

export interface CapacityFilter {
  year?: number;
  organizationName?: string;
}

export class CapacityService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateCapacityInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PARTNER';

    // Business rule: unique constraint per tenant+year+organizationName
    const existing = await (this.prisma as any).institutionalCapacity.findFirst({
      where: {
        tenantId: user.tenantId,
        year: dto.year,
        organizationName: dto.organizationName,
      },
    });

    if (existing) {
      throw new HttpError(
        409,
        `Capacity record already exists for tenant=${user.tenantId}, year=${dto.year}, organization=${dto.organizationName}`,
      );
    }

    const capacity = await (this.prisma as any).institutionalCapacity.create({
      data: {
        year: dto.year,
        organizationName: dto.organizationName,
        staffCount: dto.staffCount,
        budgetUsd: dto.budgetUsd,
        pvsSelfAssessmentScore: dto.pvsSelfAssessmentScore ?? null,
        oieStatus: dto.oieStatus ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('InstitutionalCapacity', capacity.id, 'CREATE', user, classification as any, {
      newVersion: capacity as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_CAPACITY_CREATED, capacity, user);

    return { data: capacity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: CapacityFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).institutionalCapacity.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).institutionalCapacity.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const capacity = await (this.prisma as any).institutionalCapacity.findUnique({
      where: { id },
    });

    if (!capacity) {
      throw new HttpError(404, `Capacity record ${id} not found`);
    }

    this.verifyTenantAccess(user, capacity.tenantId);

    return { data: capacity };
  }

  async update(id: string, dto: UpdateCapacityInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).institutionalCapacity.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Capacity record ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.year !== undefined) updateData['year'] = dto.year;
    if (dto.organizationName !== undefined) updateData['organizationName'] = dto.organizationName;
    if (dto.staffCount !== undefined) updateData['staffCount'] = dto.staffCount;
    if (dto.budgetUsd !== undefined) updateData['budgetUsd'] = dto.budgetUsd;
    if (dto.pvsSelfAssessmentScore !== undefined) updateData['pvsSelfAssessmentScore'] = dto.pvsSelfAssessmentScore;
    if (dto.oieStatus !== undefined) updateData['oieStatus'] = dto.oieStatus;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).institutionalCapacity.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'InstitutionalCapacity',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_CAPACITY_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: CapacityFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.year) where['year'] = filter.year;
    if (filter.organizationName) where['organizationName'] = filter.organizationName;

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
