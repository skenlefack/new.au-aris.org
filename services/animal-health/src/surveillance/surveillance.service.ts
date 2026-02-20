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
  TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
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
import { CreateSurveillanceDto } from './dto/create-surveillance.dto';
import type { SurveillanceFilterDto } from './dto/surveillance-filter.dto';
import type { SurveillanceEntity } from './entities/surveillance.entity';

const SERVICE_NAME = 'animal-health-service';

@Injectable()
export class SurveillanceService {
  private readonly logger = new Logger(SurveillanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateSurveillanceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SurveillanceEntity>> {
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

    this.audit.log('SurveillanceActivity', surveillance.id, 'CREATE', user, classification, {
      newVersion: surveillance as unknown as object,
    });

    await this.publishEvent(surveillance, user);

    this.logger.log(`Surveillance activity created: ${surveillance.id} (type=${dto.type})`);
    return { data: surveillance as SurveillanceEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: SurveillanceFilterDto,
  ): Promise<PaginatedResponse<SurveillanceEntity>> {
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
      data: data as SurveillanceEntity[],
      meta: { total, page, limit },
    };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: SurveillanceFilterDto,
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
      await this.kafkaProducer.send(
        TOPIC_MS_HEALTH_SURVEILLANCE_REPORTED,
        surveillance.id as string,
        surveillance,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish surveillance event for ${surveillance.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
