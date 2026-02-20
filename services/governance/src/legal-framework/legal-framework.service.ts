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
import { CreateLegalFrameworkDto } from './dto/create-legal-framework.dto';
import { UpdateLegalFrameworkDto } from './dto/update-legal-framework.dto';
import type { LegalFrameworkFilterDto } from './dto/legal-framework-filter.dto';
import type { LegalFrameworkEntity } from './entities/legal-framework.entity';
import { FrameworkStatus } from './entities/legal-framework.entity';
import {
  TOPIC_MS_GOVERNANCE_FRAMEWORK_CREATED,
  TOPIC_MS_GOVERNANCE_FRAMEWORK_ADOPTED,
  TOPIC_MS_GOVERNANCE_FRAMEWORK_UPDATED,
} from '../kafka-topics';

const SERVICE_NAME = 'governance-service';

@Injectable()
export class LegalFrameworkService {
  private readonly logger = new Logger(LegalFrameworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateLegalFrameworkDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    const classification = dto.dataClassification ?? DataClassification.PUBLIC;

    const framework = await this.prisma.legalFramework.create({
      data: {
        title: dto.title,
        type: dto.type,
        domain: dto.domain,
        adoptionDate: dto.adoptionDate ? new Date(dto.adoptionDate) : null,
        status: dto.status,
        documentFileId: dto.documentFileId ?? null,
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    this.audit.log('LegalFramework', framework.id, 'CREATE', user, classification, {
      newVersion: framework as unknown as object,
    });

    await this.publishEvent(TOPIC_MS_GOVERNANCE_FRAMEWORK_CREATED, framework, user);

    this.logger.log(`Legal framework created: ${framework.id} (title=${dto.title})`);
    return { data: framework as LegalFrameworkEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
    filter: LegalFrameworkFilterDto,
  ): Promise<PaginatedResponse<LegalFrameworkEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      this.prisma.legalFramework.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.legalFramework.count({ where }),
    ]);

    return {
      data: data as LegalFrameworkEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    const framework = await this.prisma.legalFramework.findUnique({
      where: { id },
    });

    if (!framework) {
      throw new NotFoundException(`Legal framework ${id} not found`);
    }

    this.verifyTenantAccess(user, framework.tenantId);

    return { data: framework as LegalFrameworkEntity };
  }

  async update(
    id: string,
    dto: UpdateLegalFrameworkDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    const existing = await this.prisma.legalFramework.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Legal framework ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.domain !== undefined) updateData['domain'] = dto.domain;
    if (dto.adoptionDate !== undefined) updateData['adoptionDate'] = new Date(dto.adoptionDate);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.documentFileId !== undefined) updateData['documentFileId'] = dto.documentFileId;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await this.prisma.legalFramework.update({
      where: { id },
      data: updateData,
    });

    this.audit.log(
      'LegalFramework',
      id,
      'UPDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_FRAMEWORK_UPDATED, updated, user);

    this.logger.log(`Legal framework updated: ${id}`);
    return { data: updated as LegalFrameworkEntity };
  }

  async adopt(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<LegalFrameworkEntity>> {
    const existing = await this.prisma.legalFramework.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Legal framework ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updated = await this.prisma.legalFramework.update({
      where: { id },
      data: {
        status: FrameworkStatus.ADOPTED,
        adoptionDate: new Date(),
        updatedBy: user.userId,
      },
    });

    this.audit.log(
      'LegalFramework',
      id,
      'VALIDATE',
      user,
      updated.dataClassification as DataClassification,
      { previousVersion: existing as unknown as object, newVersion: updated as unknown as object },
    );

    await this.publishEvent(TOPIC_MS_GOVERNANCE_FRAMEWORK_ADOPTED, updated, user);

    this.logger.log(`Legal framework adopted: ${id}`);
    return { data: updated as LegalFrameworkEntity };
  }

  private buildWhere(
    user: AuthenticatedUser,
    filter: LegalFrameworkFilterDto,
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

    if (filter.type) where['type'] = filter.type;
    if (filter.domain) where['domain'] = filter.domain;
    if (filter.status) where['status'] = filter.status;

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    // Phase 2: REC can access children
    throw new NotFoundException('Legal framework not found');
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
        `Failed to publish ${topic} for legal framework ${payload.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
