import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { CreateLabResultInput, UpdateLabResultInput, LabResultFilterInput } from '../schemas/lab-result.schema.js';
import type { PaginationQueryInput } from '../schemas/health-event.schema.js';

const SERVICE_NAME = 'animal-health-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class LabResultService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateLabResultInput, user: AuthenticatedUser) {
    // Validate linked health event exists if provided
    if (dto.healthEventId) {
      const event = await this.prisma.healthEvent.findUnique({
        where: { id: dto.healthEventId },
      });
      if (!event) {
        throw new HttpError(404, `Health event ${dto.healthEventId} not found`);
      }
    }

    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    const labResult = await this.prisma.labResult.create({
      data: {
        sampleId: dto.sampleId,
        sampleType: dto.sampleType,
        dateCollected: new Date(dto.dateCollected),
        dateReceived: new Date(dto.dateReceived),
        testType: dto.testType,
        result: dto.result,
        labId: dto.labId,
        turnaroundDays: dto.turnaroundDays,
        eqaFlag: dto.eqaFlag,
        healthEventId: dto.healthEventId ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit('LabResult', labResult.id, 'CREATE', user, classification, {
      newVersion: labResult as unknown as object,
    });

    await this.publishEvent(labResult, user);

    return { data: labResult };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQueryInput,
    filter: LabResultFilterInput,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.labResult.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.labResult.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const labResult = await this.prisma.labResult.findUnique({ where: { id } });

    if (!labResult) {
      throw new HttpError(404, `Lab result ${id} not found`);
    }

    this.verifyTenantAccess(user, labResult.tenantId);

    return { data: labResult };
  }

  async update(id: string, dto: UpdateLabResultInput, user: AuthenticatedUser) {
    const existing = await this.prisma.labResult.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Lab result ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.sampleType !== undefined) updateData['sampleType'] = dto.sampleType;
    if (dto.testType !== undefined) updateData['testType'] = dto.testType;
    if (dto.result !== undefined) updateData['result'] = dto.result;
    if (dto.turnaroundDays !== undefined) updateData['turnaroundDays'] = dto.turnaroundDays;
    if (dto.eqaFlag !== undefined) updateData['eqaFlag'] = dto.eqaFlag;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.labResult.update({
      where: { id },
      data: updateData,
    });

    this.audit('LabResult', id, 'UPDATE', user, updated.dataClassification, {
      previousVersion: existing as unknown as object,
      newVersion: updated as unknown as object,
    });

    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: LabResultFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.healthEventId) where['healthEventId'] = filter.healthEventId;
    if (filter.labId) where['labId'] = filter.labId;
    if (filter.result) where['result'] = filter.result;
    if (filter.periodStart || filter.periodEnd) {
      where['dateCollected'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new HttpError(404, 'Lab result not found');
  }

  private async publishEvent(
    labResult: { id: string; [key: string]: unknown },
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
      await this.kafka.send(
        TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
        labResult.id as string,
        labResult,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish lab result event for ${labResult.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private audit(
    entity: string,
    id: string,
    action: string,
    user: AuthenticatedUser,
    classification: string,
    extra?: object,
  ): void {
    console.log(
      JSON.stringify({
        audit: true,
        entity,
        entityId: id,
        action,
        userId: user.userId,
        tenantId: user.tenantId,
        classification,
        timestamp: new Date().toISOString(),
        ...extra,
      }),
    );
  }
}
