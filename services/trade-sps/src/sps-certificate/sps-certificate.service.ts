import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import {
  TOPIC_MS_TRADE_SPS_CERTIFIED,
  TOPIC_MS_TRADE_SPS_UPDATED,
} from '../kafka-topics';
import { CreateSpsCertificateDto } from './dto/create-sps-certificate.dto';
import { UpdateSpsCertificateDto } from './dto/update-sps-certificate.dto';
import type { SpsCertificateFilterDto } from './dto/sps-certificate-filter.dto';
import type { SpsCertificateEntity } from './entities/sps-certificate.entity';

const SERVICE_NAME = 'trade-sps-service';

@Injectable()
export class SpsCertificateService {
  private readonly logger = new Logger(SpsCertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateSpsCertificateDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    const cert = await this.prisma.spsCertificate.create({
      data: {
        certificateNumber: dto.certificateNumber,
        consignmentId: dto.consignmentId,
        exporterId: dto.exporterId,
        importerId: dto.importerId,
        speciesId: dto.speciesId,
        commodity: dto.commodity,
        quantity: dto.quantity,
        unit: dto.unit,
        originCountryId: dto.originCountryId,
        destinationCountryId: dto.destinationCountryId,
        inspectionResult: dto.inspectionResult,
        inspectionDate: new Date(dto.inspectionDate),
        certifiedBy: dto.certifiedBy,
        certifiedAt: dto.certifiedAt ? new Date(dto.certifiedAt) : null,
        status: dto.status ?? 'DRAFT',
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        remarks: dto.remarks ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('SpsCertificate', cert.id, 'CREATE', user, classification, {
      newVersion: cert as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_TRADE_SPS_CERTIFIED, cert, user);

    this.logger.log(`SPS certificate created: ${cert.id} (number=${dto.certificateNumber})`);
    return { data: cert as SpsCertificateEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: SpsCertificateFilterDto,
  ): Promise<PaginatedResponse<SpsCertificateEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.spsCertificate.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.spsCertificate.count({ where }),
    ]);

    return {
      data: data as SpsCertificateEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    const cert = await this.prisma.spsCertificate.findUnique({ where: { id } });

    if (!cert) {
      throw new NotFoundException(`SPS certificate ${id} not found`);
    }

    this.verifyTenantAccess(user, cert.tenantId);

    return { data: cert as SpsCertificateEntity };
  }

  async update(
    id: string,
    dto: UpdateSpsCertificateDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    const existing = await this.prisma.spsCertificate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`SPS certificate ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.certificateNumber !== undefined) updateData['certificateNumber'] = dto.certificateNumber;
    if (dto.consignmentId !== undefined) updateData['consignmentId'] = dto.consignmentId;
    if (dto.exporterId !== undefined) updateData['exporterId'] = dto.exporterId;
    if (dto.importerId !== undefined) updateData['importerId'] = dto.importerId;
    if (dto.speciesId !== undefined) updateData['speciesId'] = dto.speciesId;
    if (dto.commodity !== undefined) updateData['commodity'] = dto.commodity;
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.unit !== undefined) updateData['unit'] = dto.unit;
    if (dto.originCountryId !== undefined) updateData['originCountryId'] = dto.originCountryId;
    if (dto.destinationCountryId !== undefined) updateData['destinationCountryId'] = dto.destinationCountryId;
    if (dto.inspectionResult !== undefined) updateData['inspectionResult'] = dto.inspectionResult;
    if (dto.inspectionDate !== undefined) updateData['inspectionDate'] = new Date(dto.inspectionDate);
    if (dto.certifiedBy !== undefined) updateData['certifiedBy'] = dto.certifiedBy;
    if (dto.certifiedAt !== undefined) updateData['certifiedAt'] = new Date(dto.certifiedAt);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.validUntil !== undefined) updateData['validUntil'] = new Date(dto.validUntil);
    if (dto.remarks !== undefined) updateData['remarks'] = dto.remarks;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.spsCertificate.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'SpsCertificate',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_TRADE_SPS_UPDATED, updated, user);

    this.logger.log(`SPS certificate updated: ${id}`);
    return { data: updated as SpsCertificateEntity };
  }

  async issue(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<SpsCertificateEntity>> {
    const existing = await this.prisma.spsCertificate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`SPS certificate ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    if (existing.status === 'ISSUED') {
      throw new BadRequestException(`SPS certificate ${id} is already issued`);
    }

    const issued = await this.prisma.spsCertificate.update({
      where: { id },
      data: {
        status: 'ISSUED',
        certifiedAt: new Date(),
        updatedBy: user.userId,
      },
    });

    this.audit.log(
      'SpsCertificate',
      id,
      'VALIDATE',
      user,
      issued.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: issued as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_TRADE_SPS_CERTIFIED, issued, user);

    this.logger.log(`SPS certificate issued: ${id}`);
    return { data: issued as SpsCertificateEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: SpsCertificateFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Tenant scoping
    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      // REC sees own + children — service-level filter
      // Phase 2: resolve child tenantIds from tenant service
      where['tenantId'] = user.tenantId;
    }
    // CONTINENTAL: no tenant filter (sees all)

    if (filter.speciesId) where['speciesId'] = filter.speciesId;
    if (filter.originCountryId) where['originCountryId'] = filter.originCountryId;
    if (filter.destinationCountryId) where['destinationCountryId'] = filter.destinationCountryId;
    if (filter.inspectionResult) where['inspectionResult'] = filter.inspectionResult;
    if (filter.status) where['status'] = filter.status;
    if (filter.periodStart || filter.periodEnd) {
      where['inspectionDate'] = {
        ...(filter.periodStart && { gte: new Date(filter.periodStart) }),
        ...(filter.periodEnd && { lte: new Date(filter.periodEnd) }),
      };
    }

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('SPS certificate not found');
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
        `Failed to publish ${topic} for certificate ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
