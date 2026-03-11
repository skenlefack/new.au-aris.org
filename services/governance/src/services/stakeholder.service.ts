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
  TOPIC_MS_GOVERNANCE_STAKEHOLDER_CREATED,
  TOPIC_MS_GOVERNANCE_STAKEHOLDER_UPDATED,
} from '../kafka-topics.js';

const SERVICE_NAME = 'governance-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateStakeholderInput {
  name: string;
  type: string;
  contactPerson?: string;
  email?: string;
  domains: string[];
  dataClassification?: string;
}

export interface UpdateStakeholderInput {
  name?: string;
  type?: string;
  contactPerson?: string;
  email?: string;
  domains?: string[];
  dataClassification?: string;
}

export interface StakeholderFilter {
  type?: string;
  domain?: string;
}

export class StakeholderService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateStakeholderInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PUBLIC';

    const stakeholder = await (this.prisma as any).stakeholderRegistry.create({
      data: {
        name: dto.name,
        type: dto.type,
        contactPerson: dto.contactPerson ?? null,
        email: dto.email ?? null,
        domains: dto.domains,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('StakeholderRegistry', stakeholder.id, 'CREATE', user, classification as any, {
      newVersion: stakeholder as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_STAKEHOLDER_CREATED, stakeholder, user);

    return { data: stakeholder };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: StakeholderFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).stakeholderRegistry.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).stakeholderRegistry.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const stakeholder = await (this.prisma as any).stakeholderRegistry.findUnique({
      where: { id },
    });

    if (!stakeholder) {
      throw new HttpError(404, `Stakeholder ${id} not found`);
    }

    this.verifyTenantAccess(user, stakeholder.tenantId);

    return { data: stakeholder };
  }

  async update(id: string, dto: UpdateStakeholderInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).stakeholderRegistry.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Stakeholder ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.contactPerson !== undefined) updateData['contactPerson'] = dto.contactPerson;
    if (dto.email !== undefined) updateData['email'] = dto.email;
    if (dto.domains !== undefined) updateData['domains'] = dto.domains;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).stakeholderRegistry.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'StakeholderRegistry',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_STAKEHOLDER_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: StakeholderFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.type) where['type'] = filter.type;
    if (filter.domain) where['domains'] = { has: filter.domain };

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
