import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { CreateCapacityInput, UpdateCapacityInput, CapacityFilterInput } from '../schemas/capacity.schema.js';
import type { PaginationQueryInput } from '../schemas/health-event.schema.js';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class CapacityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateCapacityInput, user: AuthenticatedUser) {
    // One report per tenant per year
    const existing = await this.prisma.sVCapacity.findFirst({
      where: { tenantId: user.tenantId, year: dto.year },
    });
    if (existing) {
      throw new HttpError(409, `SV capacity report for year ${dto.year} already exists for this tenant`);
    }

    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const capacity = await this.prisma.sVCapacity.create({
      data: {
        year: dto.year,
        epiStaff: dto.epiStaff,
        labStaff: dto.labStaff,
        labTestsAvailable: dto.labTestsAvailable,
        vaccineProductionCapacity: dto.vaccineProductionCapacity ?? null,
        pvsScore: dto.pvsScore ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit('SVCapacity', capacity.id, 'CREATE', user, classification, {
      newVersion: capacity as unknown as object,
    });

    return { data: capacity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQueryInput,
    filter: CapacityFilterInput,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { year: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.sVCapacity.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.sVCapacity.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const capacity = await this.prisma.sVCapacity.findUnique({ where: { id } });

    if (!capacity) {
      throw new HttpError(404, `SV capacity ${id} not found`);
    }

    this.verifyTenantAccess(user, capacity.tenantId);

    return { data: capacity };
  }

  async update(id: string, dto: UpdateCapacityInput, user: AuthenticatedUser) {
    const existing = await this.prisma.sVCapacity.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `SV capacity ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.epiStaff !== undefined) updateData['epiStaff'] = dto.epiStaff;
    if (dto.labStaff !== undefined) updateData['labStaff'] = dto.labStaff;
    if (dto.labTestsAvailable !== undefined) updateData['labTestsAvailable'] = dto.labTestsAvailable;
    if (dto.vaccineProductionCapacity !== undefined) updateData['vaccineProductionCapacity'] = dto.vaccineProductionCapacity;
    if (dto.pvsScore !== undefined) updateData['pvsScore'] = dto.pvsScore;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.sVCapacity.update({
      where: { id },
      data: updateData,
    });

    this.audit('SVCapacity', id, 'UPDATE', user, updated.dataClassification, {
      previousVersion: existing as unknown as object,
      newVersion: updated as unknown as object,
    });

    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CapacityFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.year) where['year'] = filter.year;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new HttpError(404, 'SV capacity not found');
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
