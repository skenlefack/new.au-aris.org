import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_SYS_TENANT_CREATED,
  TOPIC_SYS_TENANT_UPDATED,
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
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import type { TenantEntity } from './entities/tenant.entity';

const SERVICE_NAME = 'tenant-service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(
    dto: CreateTenantDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TenantEntity>> {
    // Check for duplicate code
    const existing = await this.prisma.tenant.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Tenant with code "${dto.code}" already exists`);
    }

    // Validate parent exists if provided
    if (dto.parentId) {
      const parent = await this.prisma.tenant.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent tenant ${dto.parentId} not found`);
      }
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        code: dto.code,
        level: dto.level,
        parentId: dto.parentId ?? null,
        countryCode: dto.countryCode ?? null,
        recCode: dto.recCode ?? null,
        domain: dto.domain,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    // Publish Kafka event
    await this.publishEvent(
      TOPIC_SYS_TENANT_CREATED,
      tenant,
      user,
    );

    this.logger.log(`Tenant created: ${tenant.code} (${tenant.id})`);
    return { data: tenant as TenantEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<TenantEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { createdAt: 'asc' as const };

    // Build where clause based on user's tenant level
    const where = this.buildTenantFilter(user);

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: data as TenantEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TenantEntity>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    // Verify access: MS can only see own, REC can see self + children
    this.verifyTenantAccess(user, tenant.id, tenant.parentId);

    return { data: tenant as TenantEntity };
  }

  async update(
    id: string,
    dto: UpdateTenantDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TenantEntity>> {
    const existing = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Publish Kafka event
    await this.publishEvent(
      TOPIC_SYS_TENANT_UPDATED,
      tenant,
      user,
    );

    this.logger.log(`Tenant updated: ${tenant.code} (${tenant.id})`);
    return { data: tenant as TenantEntity };
  }

  async findChildren(
    id: string,
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<TenantEntity>> {
    // Verify parent tenant exists
    const parent = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!parent) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    this.verifyTenantAccess(user, parent.id, parent.parentId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { parentId: id };

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: data as TenantEntity[],
      meta: { total, page, limit },
    };
  }

  /**
   * Build Prisma where clause based on user's tenant level.
   * - CONTINENTAL: sees all tenants
   * - REC: sees self + own children (member states)
   * - MEMBER_STATE: sees only self
   */
  private buildTenantFilter(
    user: AuthenticatedUser,
  ): Record<string, unknown> {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};

      case TenantLevel.REC:
        return {
          OR: [
            { id: user.tenantId },
            { parentId: user.tenantId },
          ],
        };

      case TenantLevel.MEMBER_STATE:
        return { id: user.tenantId };

      default:
        return { id: user.tenantId };
    }
  }

  /**
   * Verify user has access to the requested tenant.
   * Throws ForbiddenException if not.
   */
  private verifyTenantAccess(
    user: AuthenticatedUser,
    tenantId: string,
    tenantParentId: string | null,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return; // AU-IBAR sees everything
    }

    if (user.tenantLevel === TenantLevel.REC) {
      // REC sees self + children
      if (tenantId === user.tenantId || tenantParentId === user.tenantId) {
        return;
      }
    }

    if (tenantId === user.tenantId) {
      return; // Own tenant
    }

    throw new NotFoundException(`Tenant ${tenantId} not found`);
  }

  private async publishEvent(
    topic: string,
    tenant: { id: string; [key: string]: unknown },
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
      await this.kafkaProducer.send(topic, tenant.id as string, tenant, headers);
    } catch (error) {
      // Log but don't fail the request — event publishing is best-effort
      this.logger.error(
        `Failed to publish ${topic} for tenant ${tenant.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
