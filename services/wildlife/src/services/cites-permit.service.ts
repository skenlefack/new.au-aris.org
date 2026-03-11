import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOPIC_MS_WILDLIFE_CITES_PERMIT_CREATED,
  TOPIC_MS_WILDLIFE_CITES_PERMIT_UPDATED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'wildlife-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export interface CreateCitesPermitInput {
  permitNumber: string;
  permitType: string;
  speciesId: string;
  quantity: number;
  unit: string;
  purpose: string;
  applicant: string;
  exportCountry: string;
  importCountry: string;
  issueDate: string;
  expiryDate: string;
  status?: string;
  dataClassification?: string;
}

export interface UpdateCitesPermitInput {
  permitNumber?: string;
  permitType?: string;
  speciesId?: string;
  quantity?: number;
  unit?: string;
  purpose?: string;
  applicant?: string;
  exportCountry?: string;
  importCountry?: string;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
  dataClassification?: string;
}

export interface CitesPermitFilter {
  speciesId?: string;
  permitType?: string;
  status?: string;
  exportCountry?: string;
  importCountry?: string;
  periodStart?: string;
  periodEnd?: string;
}

export class CitesPermitService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateCitesPermitInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'RESTRICTED';

    // Business rule: unique permit number per tenant
    const existing = await (this.prisma as any).citesPermit.findFirst({
      where: {
        tenantId: user.tenantId,
        permitNumber: dto.permitNumber,
      },
    });

    if (existing) {
      throw new HttpError(409, `CITES permit ${dto.permitNumber} already exists for this tenant`);
    }

    const permit = await (this.prisma as any).citesPermit.create({
      data: {
        permitNumber: dto.permitNumber,
        permitType: dto.permitType,
        speciesId: dto.speciesId,
        quantity: dto.quantity,
        unit: dto.unit,
        purpose: dto.purpose,
        applicant: dto.applicant,
        exportCountry: dto.exportCountry,
        importCountry: dto.importCountry,
        issueDate: new Date(dto.issueDate),
        expiryDate: new Date(dto.expiryDate),
        status: dto.status ?? 'PENDING',
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_CITES_PERMIT_CREATED, permit, user);

    return { data: permit };
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: CitesPermitFilter,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).citesPermit.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).citesPermit.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const permit = await (this.prisma as any).citesPermit.findUnique({
      where: { id },
    });

    if (!permit) {
      throw new HttpError(404, `CITES permit ${id} not found`);
    }

    this.verifyTenantAccess(user, permit.tenantId);

    return { data: permit };
  }

  async update(id: string, dto: UpdateCitesPermitInput, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).citesPermit.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `CITES permit ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.permitNumber !== undefined) updateData['permitNumber'] = dto.permitNumber;
    if (dto.permitType !== undefined) updateData['permitType'] = dto.permitType;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.purpose !== undefined) updateData['purpose'] = dto.purpose;
    if (dto.applicant !== undefined) updateData['applicant'] = dto.applicant;
    if (dto.exportCountry !== undefined) updateData['exportCountry'] = dto.exportCountry;
    if (dto.importCountry !== undefined) updateData['importCountry'] = dto.importCountry;
    if (dto.issueDate !== undefined) updateData['issueDate'] = new Date(dto.issueDate);
    if (dto.expiryDate !== undefined) updateData['expiryDate'] = new Date(dto.expiryDate);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).citesPermit.update({
      where: { id },
      data: updateData,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_CITES_PERMIT_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: CitesPermitFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter

    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.permitType) where['permitType'] = filter.permitType;
    if (filter.status) where['status'] = filter.status;
    if (filter.exportCountry) where['exportCountry'] = filter.exportCountry;
    if (filter.importCountry) where['importCountry'] = filter.importCountry;
    if (filter.periodStart || filter.periodEnd) {
      where['issueDate'] = {
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
