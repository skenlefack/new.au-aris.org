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
  TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
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
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import type { VaccinationFilterDto } from './dto/vaccination-filter.dto';
import type { VaccinationEntity } from './entities/vaccination.entity';

const SERVICE_NAME = 'animal-health-service';

export interface CoverageResult {
  vaccinationId: string;
  dosesUsed: number;
  denominator: number;
  denominatorSource: string;
  coveragePercent: number;
}

@Injectable()
export class VaccinationService {
  private readonly logger = new Logger(VaccinationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateVaccinationDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<VaccinationEntity>> {
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

    this.audit.log('VaccinationCampaign', vaccination.id, 'CREATE', user, classification, {
      newVersion: vaccination as unknown as object,
    });

    await this.publishEvent(vaccination, user);

    this.logger.log(`Vaccination campaign created: ${vaccination.id}`);
    return { data: vaccination as VaccinationEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: VaccinationFilterDto,
  ): Promise<PaginatedResponse<VaccinationEntity>> {
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
      data: data as VaccinationEntity[],
      meta: { total, page, limit },
    };
  }

  /**
   * Calculate coverage using versioned denominators from Master Data.
   * Phase 2: fetch denominator from master-data service (cached in Redis).
   * For now, uses targetPopulation from the campaign record.
   */
  async getCoverage(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CoverageResult>> {
    const vaccination = await this.prisma.vaccinationCampaign.findUnique({ where: { id } });

    if (!vaccination) {
      throw new NotFoundException(`Vaccination campaign ${id} not found`);
    }

    this.verifyTenantAccess(user, vaccination.tenantId);

    // Phase 2: fetch versioned denominator from master-data service
    const denominator = vaccination.targetPopulation;
    const denominatorSource = 'campaign-target';

    const coveragePercent = denominator > 0
      ? (vaccination.dosesUsed / denominator) * 100
      : 0;

    return {
      data: {
        vaccinationId: id,
        dosesUsed: vaccination.dosesUsed,
        denominator,
        denominatorSource,
        coveragePercent: Math.round(coveragePercent * 100) / 100,
      },
    };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: VaccinationFilterDto,
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
    throw new NotFoundException('Vaccination campaign not found');
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
      await this.kafkaProducer.send(
        TOPIC_MS_HEALTH_VACCINATION_COMPLETED,
        vaccination.id as string,
        vaccination,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish vaccination event for ${vaccination.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
