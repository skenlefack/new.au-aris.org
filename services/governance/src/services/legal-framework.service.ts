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
  TOPIC_MS_GOVERNANCE_FRAMEWORK_CREATED,
  TOPIC_MS_GOVERNANCE_FRAMEWORK_ADOPTED,
  TOPIC_MS_GOVERNANCE_FRAMEWORK_UPDATED,
} from '../kafka-topics.js';

const SERVICE_NAME = 'governance-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export enum FrameworkType {
  LAW = 'LAW',
  REGULATION = 'REGULATION',
  POLICY = 'POLICY',
  STANDARD = 'STANDARD',
  GUIDELINE = 'GUIDELINE',
}

export enum FrameworkStatus {
  DRAFT = 'DRAFT',
  ADOPTED = 'ADOPTED',
  IN_FORCE = 'IN_FORCE',
  REPEALED = 'REPEALED',
}

export interface CreateLegalFrameworkInput {
  title: string;
  type: string;
  domain: string;
  adoptionDate?: string;
  status: string;
  documentFileId?: string;
  dataClassification?: string;
}

export interface UpdateLegalFrameworkInput {
  title?: string;
  type?: string;
  domain?: string;
  adoptionDate?: string;
  status?: string;
  documentFileId?: string;
  dataClassification?: string;
}

export interface LegalFrameworkFilter {
  type?: string;
  domain?: string;
  status?: string;
}

export class LegalFrameworkService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateLegalFrameworkInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PUBLIC';

    const framework = await (this.prisma as any).legalFramework.create({
      data: {
        title: dto.title,
        type: dto.type,
        domain: dto.domain,
        adoptionDate: dto.adoptionDate ? new Date(dto.adoptionDate) : null,
        status: dto.status,
        documentFileId: dto.documentFileId ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('LegalFramework', framework.id, 'CREATE', user, classification as any, {
      newVersion: framework as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_FRAMEWORK_CREATED, framework, user);

    return { data: framework };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: LegalFrameworkFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).legalFramework.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).legalFramework.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const framework = await (this.prisma as any).legalFramework.findUnique({
      where: { id },
    });

    if (!framework) {
      throw new HttpError(404, `Legal framework ${id} not found`);
    }

    this.verifyTenantAccess(user, framework.tenantId);

    return { data: framework };
  }

  async update(id: string, dto: UpdateLegalFrameworkInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).legalFramework.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Legal framework ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.domain !== undefined) updateData['domain'] = dto.domain;
    if (dto.adoptionDate !== undefined) updateData['adoptionDate'] = new Date(dto.adoptionDate);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.documentFileId !== undefined) updateData['documentFileId'] = dto.documentFileId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).legalFramework.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'LegalFramework',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_FRAMEWORK_UPDATED, updated, user);

    return { data: updated };
  }

  async adopt(id: string, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).legalFramework.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Legal framework ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updated = await (this.prisma as any).legalFramework.update({
      where: { id },
      data: {
        status: FrameworkStatus.ADOPTED,
        adoptionDate: new Date(),
        updatedBy: user.userId,
      },
    });

    this.audit.log(
      'LegalFramework',
      id,
      'VALIDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_FRAMEWORK_ADOPTED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: LegalFrameworkFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.type) where['type'] = filter.type;
    if (filter.domain) where['domain'] = filter.domain;
    if (filter.status) where['status'] = filter.status;

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
