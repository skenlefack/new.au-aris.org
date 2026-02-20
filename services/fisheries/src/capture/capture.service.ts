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
import { CreateCaptureDto } from './dto/create-capture.dto';
import { UpdateCaptureDto } from './dto/update-capture.dto';
import type { CaptureFilterDto } from './dto/capture-filter.dto';
import type { FishCaptureEntity } from './entities/capture.entity';
import {
  TOPIC_MS_FISHERIES_CAPTURE_RECORDED,
  TOPIC_MS_FISHERIES_CAPTURE_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'fisheries-service';

@Injectable()
export class CaptureService {
  private readonly logger = new Logger(CaptureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCaptureDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FishCaptureEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    const capture = await this.prisma.fishCapture.create({
      data: {
        geoEntityId: dto.geoEntityId,
        speciesId: dto.speciesId,
        faoAreaCode: dto.faoAreaCode,
        vesselId: dto.vesselId,
        captureDate: new Date(dto.captureDate),
        quantityKg: dto.quantityKg,
        gearType: dto.gearType,
        landingSite: dto.landingSite,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('FishCapture', capture.id, 'CREATE', user, classification, {
      newVersion: capture as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_CAPTURE_RECORDED, capture, user);

    this.logger.log(`Fish capture recorded: ${capture.id} (species=${dto.speciesId}, qty=${dto.quantityKg}kg)`);
    return { data: capture as FishCaptureEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: CaptureFilterDto,
  ): Promise<PaginatedResponse<FishCaptureEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.fishCapture.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.fishCapture.count({ where }),
    ]);

    return {
      data: data as FishCaptureEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FishCaptureEntity>> {
    const capture = await this.prisma.fishCapture.findUnique({
      where: { id },
    });

    if (!capture) {
      throw new NotFoundException(`Fish capture ${id} not found`);
    }

    this.verifyTenantAccess(user, capture.tenantId);

    return { data: capture as FishCaptureEntity };
  }

  async update(
    id: string,
    dto: UpdateCaptureDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FishCaptureEntity>> {
    const existing = await this.prisma.fishCapture.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Fish capture ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.geoEntityId !== undefined) updateData['geoEntityId'] = dto.geoEntityId;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.faoAreaCode !== undefined) updateData['faoAreaCode'] = dto.faoAreaCode;
    if (dto.vesselId !== undefined) updateData['vesselId'] = dto.vesselId;
    if (dto.captureDate !== undefined) updateData['captureDate'] = new Date(dto.captureDate);
    if (dto.quantityKg !== undefined) updateData['quantityKg'] = dto.quantityKg;
    if (dto.gearType !== undefined) updateData['gearType'] = dto.gearType;
    if (dto.landingSite !== undefined) updateData['landingSite'] = dto.landingSite;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.fishCapture.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'FishCapture',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_FISHERIES_CAPTURE_UPDATED, updated, user);

    this.logger.log(`Fish capture updated: ${id}`);
    return { data: updated as FishCaptureEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CaptureFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.faoAreaCode) where['faoAreaCode'] = filter.faoAreaCode;
    if (filter.geoEntityId) where['geoEntityId'] = filter.geoEntityId;
    if (filter.vesselId) where['vesselId'] = filter.vesselId;
    if (filter.periodStart || filter.periodEnd) {
      where['captureDate'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Fish capture not found');
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
      await this.kafkaProducer.send(topic, payload.id, payload, headers);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for capture ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
