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
  CreateApiaryInput,
  UpdateApiaryInput,
  ApiaryFilterInput,
} from '../schemas/apiary.schema';
import {
  TOPIC_MS_APICULTURE_APIARY_CREATED,
  TOPIC_MS_APICULTURE_APIARY_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'apiculture-service';

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ApiaryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateApiaryInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const classification = dto.dataClassification ?? 'PARTNER';

    const apiary = await (this.prisma as any).apiary.create({
      data: {
        name: dto.name,
        geoEntityId: dto.geoEntityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        hiveCount: dto.hiveCount,
        hiveType: dto.hiveType,
        ownerName: dto.ownerName,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('Apiary', apiary.id, 'CREATE', user, classification as any, {
      newVersion: apiary as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_APICULTURE_APIARY_CREATED, apiary, user);

    console.log(`[ApiaryService] Apiary created: ${apiary.id} (name=${dto.name})`);
    return { data: apiary };
  }

  async findAll(
    user: AuthenticatedUser,
    query: ApiaryFilterInput,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).apiary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).apiary.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const apiary = await (this.prisma as any).apiary.findUnique({
      where: { id },
    });

    if (!apiary) {
      throw new HttpError(404, `Apiary ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      apiary.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Apiary ${id} not found`);
    }

    return { data: apiary };
  }

  async update(
    id: string,
    dto: UpdateApiaryInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).apiary.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Apiary ${id} not found`);
    }

    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Apiary ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.latitude !== undefined) updateData['latitude'] = dto.latitude;
    if (dto.longitude !== undefined) updateData['longitude'] = dto.longitude;
    if (dto.hiveCount !== undefined) updateData['hiveCount'] = dto.hiveCount;
    if (dto.hiveType !== undefined) updateData['hiveType'] = dto.hiveType;
    if (dto.ownerName !== undefined) updateData['ownerName'] = dto.ownerName;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).apiary.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'Apiary',
      id,
      'UPDATE',
      user,
      updated.dataClassification as any,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_APICULTURE_APIARY_UPDATED, updated, user);

    console.log(`[ApiaryService] Apiary updated: ${id}`);
    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: ApiaryFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.hiveType) where['hiveType'] = query.hiveType;
    if (query.geoEntityId) where['geoEntityId'] = query.geoEntityId;

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
