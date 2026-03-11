import { PrismaClient } from '@prisma/client';
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

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; status?: string; recordId?: string },
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { checkedAt: 'desc' as const };

    const where = this.buildFilter(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).qualityReport.findMany({
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
      (this.prisma as any).qualityReport.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<any>> {
    const report = await (this.prisma as any).qualityReport.findUnique({
      where: { id },
      include: {
        gateResults: true,
        violations: true,
        correction: true,
      },
    });

    if (!report) {
      throw new HttpError(404, `Quality report ${id} not found`);
    }

    // Tenant isolation
    if (user.tenantLevel !== TenantLevel.CONTINENTAL && report.tenantId !== user.tenantId) {
      throw new HttpError(404, `Quality report ${id} not found`);
    }

    return { data: report };
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
