import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_MS_WILDLIFE_CRIME_CREATED,
  TOPIC_MS_WILDLIFE_CRIME_UPDATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'wildlife-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateCrimeInput {
  incidentDate: string;
  geoEntityId: string;
  coordinates?: unknown;
  crimeType: string;
  speciesIds: string[];
  description: string;
  suspectsCount?: number;
  seizureDescription?: string;
  seizureQuantity?: number;
  seizureUnit?: string;
  status?: string;
  reportingAgency: string;
  dataClassification?: string;
}

export interface UpdateCrimeInput {
  incidentDate?: string;
  geoEntityId?: string;
  coordinates?: unknown;
  crimeType?: string;
  speciesIds?: string[];
  description?: string;
  suspectsCount?: number;
  seizureDescription?: string;
  seizureQuantity?: number;
  seizureUnit?: string;
  status?: string;
  reportingAgency?: string;
  dataClassification?: string;
}

export interface CrimeFilter {
  geoEntityId?: string;
  crimeType?: string;
  status?: string;
  reportingAgency?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class CrimeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateCrimeInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'RESTRICTED';

    const crime = await (this.prisma as any).wildlifeCrime.create({
      data: {
        incidentDate: new Date(dto.incidentDate),
        geoEntityId: dto.geoEntityId,
        coordinates: dto.coordinates,
        crimeType: dto.crimeType,
        speciesIds: dto.speciesIds,
        description: dto.description,
        suspectsCount: dto.suspectsCount,
        seizureDescription: dto.seizureDescription,
        seizureQuantity: dto.seizureQuantity,
        seizureUnit: dto.seizureUnit,
        status: dto.status ?? 'REPORTED',
        reportingAgency: dto.reportingAgency,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_CRIME_CREATED, crime, user);

    return { data: crime };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: CrimeFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).wildlifeCrime.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).wildlifeCrime.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const crime = await (this.prisma as any).wildlifeCrime.findUnique({
      where: { id },
    });

    if (!crime) {
      throw new HttpError(404, `Wildlife crime ${id} not found`);
    }

    this.verifyTenantAccess(user, crime.tenantId);

    return { data: crime };
  }

  async update(id: string, dto: UpdateCrimeInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).wildlifeCrime.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Wildlife crime ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.incidentDate !== undefined) updateData['incidentDate'] = new Date(dto.incidentDate);
    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.coordinates !== undefined) updateData['coordinates'] = dto.coordinates;
    if (dto.crimeType !== undefined) updateData['crimeType'] = dto.crimeType;
    if (dto.speciesIds !== undefined) updateData['speciesIds'] = dto.speciesIds;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.suspectsCount !== undefined) updateData['suspectsCount'] = dto.suspectsCount;
    if (dto.seizureDescription !== undefined) updateData['seizureDescription'] = dto.seizureDescription;
    if (dto.seizureQuantity !== undefined) updateData['seizureQuantity'] = dto.seizureQuantity;
    if (dto.seizureUnit !== undefined) updateData['seizureUnit'] = dto.seizureUnit;
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.reportingAgency !== undefined) updateData['reportingAgency'] = dto.reportingAgency;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).wildlifeCrime.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_CRIME_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: CrimeFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.crimeType) where['crimeType'] = filter.crimeType;
    if (filter.status) where['status'] = filter.status;
    if (filter.reportingAgency) where['reportingAgency'] = filter.reportingAgency;
    if (filter.periodStart || filter.periodEnd) {
      where['incidentDate'] = {
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
