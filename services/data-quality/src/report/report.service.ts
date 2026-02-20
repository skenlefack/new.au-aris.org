import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { TenantLevel } from '@aris/shared-types';
import { PrismaService } from '../prisma.service';
import type { QualityReportEntity } from '../validate/entities/quality-report.entity';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; status?: string; recordId?: string },
  ): Promise<PaginatedResponse<QualityReportEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { checkedAt: 'desc' as const };

    const where = this.buildFilter(user, query);

    const [data, total] = await Promise.all([
      this.prisma.qualityReport.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          gateResults: true,
          violations: true,
          correction: true,
        },
      }),
      this.prisma.qualityReport.count({ where }),
    ]);

    return {
      data: data as unknown as QualityReportEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<QualityReportEntity>> {
    const report = await this.prisma.qualityReport.findUnique({
      where: { id },
      include: {
        gateResults: true,
        violations: true,
        correction: true,
      },
    });

    if (!report) {
      throw new NotFoundException(`Quality report ${id} not found`);
    }

    // Tenant isolation
    if (user.tenantLevel !== TenantLevel.CONTINENTAL && report.tenantId !== user.tenantId) {
      throw new NotFoundException(`Quality report ${id} not found`);
    }

    return { data: report as unknown as QualityReportEntity };
  }

  private buildFilter(
    user: AuthenticatedUser,
    query: { domain?: string; status?: string; recordId?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Tenant isolation
    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }

    if (query.domain) where['domain'] = query.domain;
    if (query.status) where['overallStatus'] = query.status;
    if (query.recordId) where['recordId'] = query.recordId;

    return where;
  }
}
