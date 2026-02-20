import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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
import { PrismaService } from '../prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import type { RuleEntity } from './entities/rule.entity';

@Injectable()
export class RuleService {
  private readonly logger = new Logger(RuleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateRuleDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<RuleEntity>> {
    const rule = await this.prisma.customQualityRule.create({
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

    this.logger.log(`Custom rule created: ${rule.name} (${rule.id}) for ${dto.domain}/${dto.entityType}`);
    return { data: rule as unknown as RuleEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; entityType?: string },
  ): Promise<PaginatedResponse<RuleEntity>> {
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
      this.prisma.customQualityRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customQualityRule.count({ where }),
    ]);

    return {
      data: data as unknown as RuleEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<ApiResponse<RuleEntity>> {
    const rule = await this.prisma.customQualityRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Quality rule ${id} not found`);
    }
    return { data: rule as unknown as RuleEntity };
  }

  async update(
    id: string,
    dto: UpdateRuleDto,
  ): Promise<ApiResponse<RuleEntity>> {
    const existing = await this.prisma.customQualityRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Quality rule ${id} not found`);
    }

    const rule = await this.prisma.customQualityRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Custom rule updated: ${rule.name} (${rule.id})`);
    return { data: rule as unknown as RuleEntity };
  }
}
