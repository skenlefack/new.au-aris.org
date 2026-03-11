import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
  TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { CreateVaccinationInput, UpdateVaccinationInput, VaccinationFilterInput } from '../schemas/vaccination.schema.js';
import type { PaginationQueryInput } from '../schemas/health-event.schema.js';

const SERVICE_NAME = 'animal-health-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class VaccinationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: CreateVaccinationInput, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const coverageEstimate = dto.targetPopulation > 0
      ? (dto.dosesUsed / dto.targetPopulation) * 100
      : 0;

    const vaccination = await this.prisma.vaccinationCampaign.create({
      data: {
        diseaseId: dto.diseaseId,
        speciesId: dto.speciesId,
        vaccineType: dto.vaccineType,
        vaccineBatch: dto.vaccineBatch ?? null,
        dosesDelivered: dto.dosesDelivered,
        dosesUsed: dto.dosesUsed,
        targetPopulation: dto.targetPopulation,
        coverageEstimate,
        pveSerologyDone: dto.pveSerologyDone,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        geoEntityId: dto.geoEntityId,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit('VaccinationCampaign', vaccination.id, 'CREATE', user, classification, {
      newVersion: vaccination as unknown as object,
    });

    await this.publishEvent(vaccination, user);

    return { data: vaccination };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQueryInput,
    filter: VaccinationFilterInput,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.vaccinationCampaign.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.vaccinationCampaign.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const vaccination = await this.prisma.vaccinationCampaign.findUnique({ where: { id } });

    if (!vaccination) {
      throw new HttpError(404, `Vaccination campaign ${id} not found`);
    }

    this.verifyTenantAccess(user, vaccination.tenantId);

    return { data: vaccination };
  }

  async update(id: string, dto: UpdateVaccinationInput, user: AuthenticatedUser) {
    const existing = await this.prisma.vaccinationCampaign.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Vaccination campaign ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.vaccineType !== undefined) updateData['vaccineType'] = dto.vaccineType;
    if (dto.vaccineBatch !== undefined) updateData['vaccineBatch'] = dto.vaccineBatch;
    if (dto.dosesDelivered !== undefined) updateData['dosesDelivered'] = dto.dosesDelivered;
    if (dto.dosesUsed !== undefined) updateData['dosesUsed'] = dto.dosesUsed;
    if (dto.targetPopulation !== undefined) updateData['targetPopulation'] = dto.targetPopulation;
    if (dto.pveSerologyDone !== undefined) updateData['pveSerologyDone'] = dto.pveSerologyDone;
    if (dto.periodStart !== undefined) updateData['periodStart'] = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) updateData['periodEnd'] = new Date(dto.periodEnd);
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    // Recalculate coverage if doses or target changed
    const dosesUsed = (dto.dosesUsed !== undefined ? dto.dosesUsed : existing.dosesUsed);
    const targetPop = (dto.targetPopulation !== undefined ? dto.targetPopulation : existing.targetPopulation);
    if (dto.dosesUsed !== undefined || dto.targetPopulation !== undefined) {
      updateData['coverageEstimate'] = targetPop > 0
        ? (dosesUsed / targetPop) * 100
        : 0;
    }

    const updated = await this.prisma.vaccinationCampaign.update({
      where: { id },
      data: updateData,
    });

    this.audit('VaccinationCampaign', id, 'UPDATE', user, updated.dataClassification, {
      previousVersion: existing as unknown as object,
      newVersion: updated as unknown as object,
    });

    return { data: updated };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: VaccinationFilterInput,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.diseaseId) where['diseaseId'] = filter.diseaseId;
    if (filter.speciesId) where['speciesId'] = filter.speciesId;
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
    throw new HttpError(404, 'Vaccination campaign not found');
  }

  private async publishEvent(
    vaccination: { id: string; [key: string]: unknown },
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
        TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
        vaccination.id as string,
        vaccination,
        headers,
      );
    } catch (error) {
      console.error(
        `Failed to publish vaccination event for ${vaccination.id}`,
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
