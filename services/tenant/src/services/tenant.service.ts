import { randomUUID } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
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

const SERVICE_NAME = 'tenant-service';

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  tenantLevel: string;
  locale?: string;
}

interface TenantEntity {
  id: string;
  name: string;
  code: string;
  level: string;
  parentId: string | null;
  countryCode: string | null;
  recCode: string | null;
  domain: string;
  config: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class TenantService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: { name: string; code: string; level: string; parentId?: string; countryCode?: string; recCode?: string; domain: string; config?: Record<string, unknown>; isActive?: boolean },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TenantEntity>> {
    const existing = await (this.prisma as any).tenant.findUnique({ where: { code: dto.code } });
    if (existing) throw new HttpError(409, `Tenant with code "${dto.code}" already exists`);

    if (dto.parentId) {
      const parent = await (this.prisma as any).tenant.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new HttpError(404, `Parent tenant ${dto.parentId} not found`);
    }

    const tenant = await (this.prisma as any).tenant.create({
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

    await this.publishEvent(TOPIC_SYS_TENANT_CREATED, tenant, user);
    return { data: tenant as TenantEntity };
  }

  async findAll(user: AuthenticatedUser, query: PaginationQuery): Promise<PaginatedResponse<TenantEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const orderBy = query.sort ? { [query.sort]: query.order ?? 'asc' } : { createdAt: 'asc' as const };
    const where = this.buildTenantFilter(user);

    const [data, total] = await Promise.all([
      (this.prisma as any).tenant.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).tenant.count({ where }),
    ]);

    return { data: data as TenantEntity[], meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ApiResponse<TenantEntity>> {
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!tenant) throw new HttpError(404, `Tenant ${id} not found`);
    this.verifyTenantAccess(user, tenant.id, tenant.parentId);
    return { data: tenant as TenantEntity };
  }

  async update(
    id: string,
    dto: { name?: string; domain?: string; config?: Record<string, unknown>; isActive?: boolean },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<TenantEntity>> {
    const existing = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, `Tenant ${id} not found`);

    const tenant = await (this.prisma as any).tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.publishEvent(TOPIC_SYS_TENANT_UPDATED, tenant, user);
    return { data: tenant as TenantEntity };
  }

  async findChildren(id: string, user: AuthenticatedUser, query: PaginationQuery): Promise<PaginatedResponse<TenantEntity>> {
    const parent = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!parent) throw new HttpError(404, `Tenant ${id} not found`);
    this.verifyTenantAccess(user, parent.id, parent.parentId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const where = { parentId: id };

    const [data, total] = await Promise.all([
      (this.prisma as any).tenant.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      (this.prisma as any).tenant.count({ where }),
    ]);

    return { data: data as TenantEntity[], meta: { total, page, limit } };
  }

  private buildTenantFilter(user: AuthenticatedUser): Record<string, unknown> {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL: return {};
      case TenantLevel.REC: return { OR: [{ id: user.tenantId }, { parentId: user.tenantId }] };
      case TenantLevel.MEMBER_STATE: return { id: user.tenantId };
      default: return { id: user.tenantId };
    }
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string, tenantParentId: string | null): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantLevel === TenantLevel.REC) {
      if (tenantId === user.tenantId || tenantParentId === user.tenantId) return;
    }
    if (tenantId === user.tenantId) return;
    throw new HttpError(404, `Tenant ${tenantId} not found`);
  }

  private async publishEvent(topic: string, tenant: { id: string; [key: string]: unknown }, user: AuthenticatedUser): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(), sourceService: SERVICE_NAME, tenantId: user.tenantId,
      userId: user.userId, schemaVersion: '1', timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, tenant.id as string, tenant, headers); } catch {}
  }
}
