import {
  Injectable,
  NotFoundException,
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
import { CreateVesselDto } from './dto/create-vessel.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import type { VesselFilterDto } from './dto/vessel-filter.dto';
import type { FishingVesselEntity } from './entities/vessel.entity';
import {
  TOPIC_MS_FISHERIES_VESSEL_REGISTERED,
  TOPIC_MS_FISHERIES_VESSEL_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'fisheries-service';

@Injectable()
export class VesselService {
  private readonly logger = new Logger(VesselService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateVesselDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FishingVesselEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PARTNER;

    // Business rule: unique registration number per tenant
    const existing = await this.prisma.fishingVessel.findFirst({
      where: {
        tenantId: user.tenantId,
        registrationNumber: dto.registrationNumber,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Vessel with registration ${dto.registrationNumber} already exists for tenant=${user.tenantId}`,
      );
    }

    const vessel = await this.prisma.fishingVessel.create({
      data: {
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        flagState: dto.flagState,
        vesselType: dto.vesselType,
        lengthMeters: dto.lengthMeters,
        tonnageGt: dto.tonnageGt,
        homePort: dto.homePort,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
        isActive: dto.isActive ?? true,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('FishingVessel', vessel.id, 'CREATE', user, classification, {
      newVersion: vessel as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_FISHERIES_VESSEL_REGISTERED, vessel, user);

    this.logger.log(`Vessel registered: ${vessel.id} (${dto.name}, reg=${dto.registrationNumber})`);
    return { data: vessel as FishingVesselEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: VesselFilterDto,
  ): Promise<PaginatedResponse<FishingVesselEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.fishingVessel.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.fishingVessel.count({ where }),
    ]);

    return {
      data: data as FishingVesselEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FishingVesselEntity>> {
    const vessel = await this.prisma.fishingVessel.findUnique({
      where: { id },
    });

    if (!vessel) {
      throw new NotFoundException(`Vessel ${id} not found`);
    }

    this.verifyTenantAccess(user, vessel.tenantId);

    return { data: vessel as FishingVesselEntity };
  }

  async update(
    id: string,
    dto: UpdateVesselDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<FishingVesselEntity>> {
    const existing = await this.prisma.fishingVessel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Vessel ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.registrationNumber !== undefined) updateData['registrationNumber'] = dto.registrationNumber;
    if (dto.flagState !== undefined) updateData['flagState'] = dto.flagState;
    if (dto.vesselType !== undefined) updateData['vesselType'] = dto.vesselType;
    if (dto.lengthMeters !== undefined) updateData['lengthMeters'] = dto.lengthMeters;
    if (dto.tonnageGt !== undefined) updateData['tonnageGt'] = dto.tonnageGt;
    if (dto.homePort !== undefined) updateData['homePort'] = dto.homePort;
    if (dto.licenseNumber !== undefined) updateData['licenseNumber'] = dto.licenseNumber;
    if (dto.licenseExpiry !== undefined) updateData['licenseExpiry'] = new Date(dto.licenseExpiry);
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.fishingVessel.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'FishingVessel',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_FISHERIES_VESSEL_UPDATED, updated, user);

    this.logger.log(`Vessel updated: ${id}`);
    return { data: updated as FishingVesselEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: VesselFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.flagState) where['flagState'] = filter.flagState;
    if (filter.vesselType) where['vesselType'] = filter.vesselType;
    if (filter.homePort) where['homePort'] = filter.homePort;
    if (filter.isActive !== undefined) where['isActive'] = filter.isActive;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new NotFoundException('Vessel not found');
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
        `Failed to publish ${topic} for vessel ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
