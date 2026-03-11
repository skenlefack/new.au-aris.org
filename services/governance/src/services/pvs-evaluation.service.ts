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
  TOPIC_MS_GOVERNANCE_PVS_EVALUATED,
  TOPIC_MS_GOVERNANCE_PVS_UPDATED,
} from '../kafka-topics.js';

const SERVICE_NAME = 'governance-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreatePvsEvaluationInput {
  evaluationType: string;
  evaluationDate: string;
  overallScore: number;
  criticalCompetencies: Record<string, unknown>;
  recommendations: string[];
  dataClassification?: string;
}

export interface UpdatePvsEvaluationInput {
  evaluationType?: string;
  evaluationDate?: string;
  overallScore?: number;
  criticalCompetencies?: Record<string, unknown>;
  recommendations?: string[];
  dataClassification?: string;
}

export interface PvsEvaluationFilter {
  evaluationType?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class PvsEvaluationService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreatePvsEvaluationInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PARTNER';

    const evaluation = await (this.prisma as any).pVSEvaluation.create({
      data: {
        evaluationType: dto.evaluationType,
        evaluationDate: new Date(dto.evaluationDate),
        overallScore: dto.overallScore,
        criticalCompetencies: dto.criticalCompetencies,
        recommendations: dto.recommendations,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('PVSEvaluation', evaluation.id, 'CREATE', user, classification as any, {
      newVersion: evaluation as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_PVS_EVALUATED, evaluation, user);

    return { data: evaluation };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: PvsEvaluationFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).pVSEvaluation.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).pVSEvaluation.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const evaluation = await (this.prisma as any).pVSEvaluation.findUnique({
      where: { id },
    });

    if (!evaluation) {
      throw new HttpError(404, `PVS evaluation ${id} not found`);
    }

    this.verifyTenantAccess(user, evaluation.tenantId);

    return { data: evaluation };
  }

  async update(id: string, dto: UpdatePvsEvaluationInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).pVSEvaluation.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `PVS evaluation ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.evaluationType !== undefined) updateData['evaluationType'] = dto.evaluationType;
    if (dto.evaluationDate !== undefined) updateData['evaluationDate'] = new Date(dto.evaluationDate);
    if (dto.overallScore !== undefined) updateData['overallScore'] = dto.overallScore;
    if (dto.criticalCompetencies !== undefined) updateData['criticalCompetencies'] = dto.criticalCompetencies;
    if (dto.recommendations !== undefined) updateData['recommendations'] = dto.recommendations;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).pVSEvaluation.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'PVSEvaluation',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_PVS_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: PvsEvaluationFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.evaluationType) where['evaluationType'] = filter.evaluationType;
    if (filter.periodStart || filter.periodEnd) {
      where['evaluationDate'] = {
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
