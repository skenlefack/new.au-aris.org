import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_FISHERIES_VESSEL_CREATED,
  TOPIC_MS_FISHERIES_VESSEL_UPDATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders, PaginatedResponse, ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'fisheries-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class VesselService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: {
      name: string;
      registrationNumber: string;
      flagState: string;
      vesselType: string;
      lengthMeters: number;
      tonnageGt: number;
      homePort: string;
      licenseNumber?: string;
      licenseExpiry?: string;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    // Check unique registrationNumber per tenant
    const existing = await (this.prisma as any).fishingVessel.findFirst({
      where: {
        tenantId: user.tenantId,
        registrationNumber: dto.registrationNumber,
      },
    });

    if (existing) {
      throw new HttpError(409, `Vessel with registration number ${dto.registrationNumber} already exists for this tenant`);
    }

    const vessel = await (this.prisma as any).fishingVessel.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        flagState: dto.flagState,
        vesselType: dto.vesselType,
        lengthMeters: dto.lengthMeters,
        tonnageGt: dto.tonnageGt,
        homePort: dto.homePort,
        licenseNumber: dto.licenseNumber ?? null,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
        dataClassification: dto.dataClassification ?? 'PARTNER',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_VESSEL_CREATED, { id: vessel.id, ...vessel }, user);

    return { data: vessel };
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      vesselType?: string;
      portOfRegistry?: string;
    },
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where = this.buildWhere(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).fishingVessel.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).fishingVessel.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ApiResponse<unknown>> {
    const vessel = await (this.prisma as any).fishingVessel.findUnique({ where: { id } });

    if (!vessel) {
      throw new HttpError(404, `Vessel ${id} not found`);
    }

    this.verifyTenantAccess(user, vessel.tenantId);

    return { data: vessel };
  }

  async update(
    id: string,
    dto: {
      name?: string;
      registrationNumber?: string;
      flagState?: string;
      vesselType?: string;
      lengthMeters?: number;
      tonnageGt?: number;
      homePort?: string;
      licenseNumber?: string;
      licenseExpiry?: string;
      isActive?: boolean;
      dataClassification?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const existing = await (this.prisma as any).fishingVessel.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, `Vessel ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    // If updating registrationNumber, check uniqueness within tenant
    if (dto.registrationNumber && dto.registrationNumber !== existing.registrationNumber) {
      const duplicate = await (this.prisma as any).fishingVessel.findFirst({
        where: {
          tenantId: existing.tenantId,
          registrationNumber: dto.registrationNumber,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new HttpError(409, `Vessel with registration number ${dto.registrationNumber} already exists for this tenant`);
      }
    }

    const vessel = await (this.prisma as any).fishingVessel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
        ...(dto.flagState !== undefined && { flagState: dto.flagState }),
        ...(dto.vesselType !== undefined && { vesselType: dto.vesselType }),
        ...(dto.lengthMeters !== undefined && { lengthMeters: dto.lengthMeters }),
        ...(dto.tonnageGt !== undefined && { tonnageGt: dto.tonnageGt }),
        ...(dto.homePort !== undefined && { homePort: dto.homePort }),
        ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber }),
        ...(dto.licenseExpiry !== undefined && { licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.dataClassification !== undefined && { dataClassification: dto.dataClassification }),
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_VESSEL_UPDATED, { id: vessel.id, ...vessel }, user);

    return { data: vessel };
  }

  private buildWhere(
    user: AuthenticatedUser,
    query: { vesselType?: string; portOfRegistry?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (query.vesselType) where['vesselType'] = query.vesselType;
    if (query.portOfRegistry) where['homePort'] = query.portOfRegistry;

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
      console.error(`Failed to publish ${topic}`, error);
    }
  }
}
