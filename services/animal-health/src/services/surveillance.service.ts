import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { CreateSurveillanceInput, UpdateSurveillanceInput, SurveillanceFilterInput } from '../schemas/surveillance.schema.js';
import type { PaginationQueryInput } from '../schemas/health-event.schema.js';

const SERVICE_NAME = 'animal-health-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class SurveillanceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateSurveillanceInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const surveillance = await this.prisma.surveillanceActivity.create({
      data: {
        type: dto.type,
        diseaseId: dto.diseaseId,
        designType: dto.designType ?? null,
        sampleSize: dto.sampleSize,
        positivityRate: dto.positivityRate ?? null,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        geoEntityId: dto.geoEntityId,
        mapLayerId: dto.mapLayerId ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit('SurveillanceActivity', surveillance.id, 'CREATE', user, classification, {
      newVersion: surveillance as unknown as object,
    });

    await this.publishEvent(surveillance, user);

    return { data: surveillance };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQueryInput,
    filter: SurveillanceFilterInput,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.surveillanceActivity.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.surveillanceActivity.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const surveillance = await this.prisma.surveillanceActivity.findUnique({ where: { id } });

    if (!surveillance) {
      throw new HttpError(404, `Surveillance activity ${id} not found`);
    }

    this.verifyTenantAccess(user, surveillance.tenantId);

    return { data: surveillance };
  }

  async update(id: string, dto: UpdateSurveillanceInput, user: AuthenticatedUser) {
    const existing = await this.prisma.surveillanceActivity.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Surveillance activity ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.designType !== undefined) updateData['designType'] = dto.designType;
    if (dto.sampleSize !== undefined) updateData['sampleSize'] = dto.sampleSize;
    if (dto.positivityRate !== undefined) updateData['positivityRate'] = dto.positivityRate;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.surveillanceActivity.update({
      where: { id },
      data: updateData,
    });

    this.audit('SurveillanceActivity', id, 'UPDATE', user, updated.dataClassification, {
      previousVersion: existing as unknown as object,
      newVersion: updated as unknown as object,
    });

    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: SurveillanceFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.type) where['type'] = filter.type;
    if (filter.diseaseId) where['diseaseId'] = filter.diseaseId;
    if (filter.periodStart || filter.periodEnd) {
      where['periodStart'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new HttpError(404, 'Surveillance activity not found');
  }

  private async publishEvent(
    surveillance: { id: string; [key: string]: unknown },
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
        TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
        surveillance.id as string,
        surveillance,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish surveillance event for ${surveillance.id}`,
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
