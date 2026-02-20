import {
  Injectable,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  DataClassification,
  TenantLevel,
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
import { CreateCapacityDto } from './dto/create-capacity.dto';
import type { CapacityFilterDto } from './dto/capacity-filter.dto';
import type { CapacityEntity } from './entities/capacity.entity';

const SERVICE_NAME = 'animal-health-service';

@Injectable()
export class CapacityService {
  private readonly logger = new Logger(CapacityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCapacityDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CapacityEntity>> {
    // One report per tenant per year
    const existing = await this.prisma.svCapacity.findFirst({
      where: { tenantId: user.tenantId, year: dto.year },
    });
    if (existing) {
      throw new ConflictException(
        `SV capacity report for year ${dto.year} already exists for this tenant`,
      );
    }

    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const capacity = await this.prisma.svCapacity.create({
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

    this.audit.log('SVCapacity', capacity.id, 'CREATE', user, classification, {
      newVersion: capacity as unknown as object,
    });

    this.logger.log(`SV capacity created: ${capacity.id} (year=${dto.year})`);
    return { data: capacity as CapacityEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: CapacityFilterDto,
  ): Promise<PaginatedResponse<CapacityEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { year: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.svCapacity.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.svCapacity.count({ where }),
    ]);

    return {
      data: data as CapacityEntity[],
      meta: { total, page, limit },
    };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CapacityFilterDto,
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
}
