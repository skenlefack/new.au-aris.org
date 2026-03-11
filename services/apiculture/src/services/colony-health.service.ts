import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
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
import type { AuditService } from './audit.service';
import type {
  CreateColonyHealthInput,
  UpdateColonyHealthInput,
  ColonyHealthFilterInput,
} from '../schemas/colony-health.schema';
import {
  TOPIC_MS_APICULTURE_HEALTH_INSPECTED,
  TOPIC_MS_APICULTURE_HEALTH_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ColonyHealthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateColonyHealthInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const classification = dto.dataClassification ?? 'PARTNER';

    const inspection = await (this.prisma as any).colonyHealth.create({
      data: {
        apiaryId: dto.apiaryId,
        inspectionDate: dto.inspectionDate,
        colonyStrength: dto.colonyStrength,
        diseases: dto.diseases,
        treatments: dto.treatments,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('ColonyHealth', inspection.id, 'CREATE', user, classification as any, {
      newVersion: inspection as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_HEALTH_INSPECTED, inspection, user);

    console.log(`[ColonyHealthService] Colony health inspection created: ${inspection.id} (apiary=${dto.apiaryId})`);
    return { data: inspection };
  }

  async findAll(
    user: AuthenticatedUser,
    query: ColonyHealthFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).colonyHealth.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).colonyHealth.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const inspection = await (this.prisma as any).colonyHealth.findUnique({
      where: { id },
    });

    if (!inspection) {
      throw new HttpError(404, `Colony health inspection ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      inspection.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Colony health inspection ${id} not found`);
    }

    return { data: inspection };
  }

  async update(
    id: string,
    dto: UpdateColonyHealthInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).colonyHealth.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Colony health inspection ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Colony health inspection ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.apiaryId !== undefined) updateData['apiaryId'] = dto.apiaryId;
    if (dto.inspectionDate !== undefined) updateData['inspectionDate'] = dto.inspectionDate;
    if (dto.colonyStrength !== undefined) updateData['colonyStrength'] = dto.colonyStrength;
    if (dto.diseases !== undefined) updateData['diseases'] = dto.diseases;
    if (dto.treatments !== undefined) updateData['treatments'] = dto.treatments;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).colonyHealth.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'ColonyHealth',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_HEALTH_UPDATED, updated, user);

    console.log(`[ColonyHealthService] Colony health inspection updated: ${id}`);
    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: ColonyHealthFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.apiaryId) where['apiaryId'] = query.apiaryId;
    if (query.colonyStrength) where['colonyStrength'] = query.colonyStrength;
    if (query.disease) where['diseases'] = { has: query.disease };

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
