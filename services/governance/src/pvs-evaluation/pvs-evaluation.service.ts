import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { CreatePVSEvaluationDto } from './dto/create-pvs-evaluation.dto';
import { UpdatePVSEvaluationDto } from './dto/update-pvs-evaluation.dto';
import type { PVSEvaluationFilterDto } from './dto/pvs-evaluation-filter.dto';
import type { PVSEvaluationEntity } from './entities/pvs-evaluation.entity';
import {
  TOPIC_MS_GOVERNANCE_PVS_EVALUATED,
  TOPIC_MS_GOVERNANCE_PVS_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'governance-service';

@Injectable()
export class PvsEvaluationService {
  private readonly logger = new Logger(PvsEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreatePVSEvaluationDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PVSEvaluationEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const evaluation = await this.prisma.pVSEvaluation.create({
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

    this.audit.log('PVSEvaluation', evaluation.id, 'CREATE', user, classification, {
      newVersion: evaluation as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_PVS_EVALUATED, evaluation, user);

    this.logger.log(`PVS evaluation created: ${evaluation.id} (type=${dto.evaluationType})`);
    return { data: evaluation as PVSEvaluationEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: PVSEvaluationFilterDto,
  ): Promise<PaginatedResponse<PVSEvaluationEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.pVSEvaluation.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.pVSEvaluation.count({ where }),
    ]);

    return {
      data: data as PVSEvaluationEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PVSEvaluationEntity>> {
    const evaluation = await this.prisma.pVSEvaluation.findUnique({
      where: { id },
    });

    if (!evaluation) {
      throw new NotFoundException(`PVS evaluation ${id} not found`);
    }

    this.verifyTenantAccess(user, evaluation.tenantId);

    return { data: evaluation as PVSEvaluationEntity };
  }

  async update(
    id: string,
    dto: UpdatePVSEvaluationDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<PVSEvaluationEntity>> {
    const existing = await this.prisma.pVSEvaluation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`PVS evaluation ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.evaluationType !== undefined) updateData['evaluationType'] = dto.evaluationType;
    if (dto.evaluationDate !== undefined) updateData['evaluationDate'] = new Date(dto.evaluationDate);
    if (dto.overallScore !== undefined) updateData['overallScore'] = dto.overallScore;
    if (dto.criticalCompetencies !== undefined) updateData['criticalCompetencies'] = dto.criticalCompetencies;
    if (dto.recommendations !== undefined) updateData['recommendations'] = dto.recommendations;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.pVSEvaluation.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'PVSEvaluation',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_PVS_UPDATED, updated, user);

    this.logger.log(`PVS evaluation updated: ${id}`);
    return { data: updated as PVSEvaluationEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: PVSEvaluationFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Tenant scoping
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      // REC sees own + children — service-level filter
      // Phase 2: resolve child tenantIds from tenant service
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter (sees all)

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
    // Phase 2: REC can access children
    throw new NotFoundException('PVS evaluation not found');
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
      await this.kafkaProducer.send(topic, payload.id, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for PVS evaluation ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
