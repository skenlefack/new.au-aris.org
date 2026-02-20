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
import { CreateCitesPermitDto } from './dto/create-cites-permit.dto';
import { UpdateCitesPermitDto } from './dto/update-cites-permit.dto';
import type { CitesPermitFilterDto } from './dto/cites-permit-filter.dto';
import type { CITESPermitEntity } from './entities/cites-permit.entity';
import {
  TOPIC_MS_WILDLIFE_CITES_ISSUED,
  TOPIC_MS_WILDLIFE_CITES_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'wildlife-service';

@Injectable()
export class CitesPermitService {
  private readonly logger = new Logger(CitesPermitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCitesPermitDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CITESPermitEntity>> {
    const classification = dto.dataClassification ?? DataClassification.RESTRICTED;

    // Business rule: unique permit number per tenant
    const existing = await this.prisma.citesPermit.findFirst({
      where: {
        tenantId: user.tenantId,
        permitNumber: dto.permitNumber,
      },
    });

    if (existing) {
      throw new ConflictException(
        `CITES permit ${dto.permitNumber} already exists for tenant=${user.tenantId}`,
      );
    }

    const permit = await this.prisma.citesPermit.create({
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
        status: dto.status ?? 'issued',
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('CITESPermit', permit.id, 'CREATE', user, classification, {
      newVersion: permit as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_WILDLIFE_CITES_ISSUED, permit, user);

    this.logger.log(`CITES permit issued: ${permit.id} (${dto.permitNumber})`);
    return { data: permit as CITESPermitEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: CitesPermitFilterDto,
  ): Promise<PaginatedResponse<CITESPermitEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.citesPermit.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.citesPermit.count({ where }),
    ]);

    return {
      data: data as CITESPermitEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CITESPermitEntity>> {
    const permit = await this.prisma.citesPermit.findUnique({
      where: { id },
    });

    if (!permit) {
      throw new NotFoundException(`CITES permit ${id} not found`);
    }

    this.verifyTenantAccess(user, permit.tenantId);

    return { data: permit as CITESPermitEntity };
  }

  async update(
    id: string,
    dto: UpdateCitesPermitDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CITESPermitEntity>> {
    const existing = await this.prisma.citesPermit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CITES permit ${id} not found`);
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

    const updated = await this.prisma.citesPermit.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'CITESPermit',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_WILDLIFE_CITES_UPDATED, updated, user);

    this.logger.log(`CITES permit updated: ${id}`);
    return { data: updated as CITESPermitEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: CitesPermitFilterDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE) {
      where['tenantId'] = user.tenantId;
    } else if (user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

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
    throw new NotFoundException('CITES permit not found');
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
        `Failed to publish ${topic} for permit ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
