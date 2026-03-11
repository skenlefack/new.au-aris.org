import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TenantLevel,
} from '@aris/shared-types';
import type {
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface CreateRuleDto {
  domain: string;
  entityType: string;
  name: string;
  description?: string;
  gate: string;
  config: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateRuleDto {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export class RuleService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    dto: CreateRuleDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<any>> {
    const rule = await (this.prisma as any).customQualityRule.create({
      data: {
        domain: dto.domain,
        entityType: dto.entityType,
        tenantId: user.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        gate: dto.gate,
        config: dto.config as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        createdBy: user.userId,
      },
    });

    console.log(`[RuleService] Custom rule created: ${rule.name} (${rule.id}) for ${dto.domain}/${dto.entityType}`);
    return { data: rule };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; entityType?: string },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }
    if (query.domain) where['domain'] = query.domain;
    if (query.entityType) where['entityType'] = query.entityType;

    const [data, total] = await Promise.all([
      (this.prisma as any).customQualityRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).customQualityRule.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const rule = await (this.prisma as any).customQualityRule.findUnique({ where: { id } });
    if (!rule) {
      throw new HttpError(404, `Quality rule ${id} not found`);
    }
    return { data: rule };
  }

  async update(
    id: string,
    dto: UpdateRuleDto,
  ): Promise<ApiResponse<any>> {
    const existing = await (this.prisma as any).customQualityRule.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Quality rule ${id} not found`);
    }

    const rule = await (this.prisma as any).customQualityRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    console.log(`[RuleService] Custom rule updated: ${rule.name} (${rule.id})`);
    return { data: rule };
  }
}
