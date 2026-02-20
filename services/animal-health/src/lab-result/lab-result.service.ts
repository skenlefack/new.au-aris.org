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
  TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
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
import { CreateLabResultDto } from './dto/create-lab-result.dto';
import type { LabResultFilterDto } from './dto/lab-result-filter.dto';
import type { LabResultEntity } from './entities/lab-result.entity';

const SERVICE_NAME = 'animal-health-service';

@Injectable()
export class LabResultService {
  private readonly logger = new Logger(LabResultService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateLabResultDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LabResultEntity>> {
    // Validate linked health event exists if provided
    if (dto.healthEventId) {
      const event = await this.prisma.healthEvent.findUnique({
        where: { id: dto.healthEventId },
      });
      if (!event) {
        throw new NotFoundException(`Health event ${dto.healthEventId} not found`);
      }
    }

    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    const labResult = await this.prisma.labResult.create({
      data: {
        sampleId: dto.sampleId,
        sampleType: dto.sampleType,
        dateCollected: new Date(dto.dateCollected),
        dateReceived: new Date(dto.dateReceived),
        testType: dto.testType,
        result: dto.result,
        labId: dto.labId,
        turnaroundDays: dto.turnaroundDays,
        eqaFlag: dto.eqaFlag,
        healthEventId: dto.healthEventId ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('LabResult', labResult.id, 'CREATE', user, classification, {
      newVersion: labResult as unknown as object,
    });

    await this.publishEvent(labResult, user);

    this.logger.log(`Lab result created: ${labResult.id} (sample=${dto.sampleId})`);
    return { data: labResult as LabResultEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: LabResultFilterDto,
  ): Promise<PaginatedResponse<LabResultEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.labResult.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.labResult.count({ where }),
    ]);

    return {
      data: data as LabResultEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LabResultEntity>> {
    const labResult = await this.prisma.labResult.findUnique({ where: { id } });

    if (!labResult) {
      throw new NotFoundException(`Lab result ${id} not found`);
    }

    this.verifyTenantAccess(user, labResult.tenantId);

    return { data: labResult as LabResultEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: LabResultFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.healthEventId) where['healthEventId'] = filter.healthEventId;
    if (filter.labId) where['labId'] = filter.labId;
    if (filter.result) where['result'] = filter.result;
    if (filter.periodStart || filter.periodEnd) {
      where['dateCollected'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Lab result not found');
  }

  private async publishEvent(
    labResult: { id: string; [key: string]: unknown },
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
        TOPIC_MS_HEALTH_LAB_RESULT_CREATED,
        labResult.id as string,
        labResult,
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish lab result event for ${labResult.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
