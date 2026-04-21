import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  search?: string;
}

export interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  actorRole: string;
  actorTenantId: string;
  reason?: string;
  previousVersion?: object;
  newVersion?: object;
  dataClassification?: string;
  serviceName: string;
  ipAddress?: string;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Query audit log with pagination, filters, and actor email resolution */
  async query(caller: AuthenticatedUser, params: AuditQueryParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Tenant scoping: SUPER_ADMIN sees all, others see their tenant
    if (caller.role !== 'SUPER_ADMIN') {
      where.actorTenantId = caller.tenantId;
    }

    if (params.action) {
      where.action = params.action;
    }

    if (params.entityType) {
      where.entityType = params.entityType;
    }

    if (params.search) {
      where.OR = [
        { entityType: { contains: params.search, mode: 'insensitive' } },
        { entityId: { contains: params.search, mode: 'insensitive' } },
        { reason: { contains: params.search, mode: 'insensitive' } },
        { actorRole: { contains: params.search, mode: 'insensitive' } },
        { serviceName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const p = this.prisma as any;

    const [entries, total] = await Promise.all([
      p.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      p.auditLog.count({ where }),
    ]);

    // Resolve actor emails from user table
    const actorIds = [...new Set(entries.map((e: any) => e.actorUserId).filter(Boolean))];
    let actorMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const users = await p.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true },
      });
      actorMap = Object.fromEntries(users.map((u: any) => [u.id, u.email]));
    }

    const data = entries.map((e: any) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      actor: {
        userId: e.actorUserId ?? '',
        email: actorMap[e.actorUserId] ?? 'system',
        role: e.actorRole ?? '',
        tenantId: e.actorTenantId ?? '',
      },
      timestamp: e.timestamp.toISOString(),
      reason: e.reason ?? undefined,
      dataClassification: e.dataClassification,
      previousVersion: e.previousVersion ?? undefined,
      newVersion: e.newVersion ?? undefined,
      serviceName: e.serviceName,
    }));

    return {
      data,
      meta: { total, page, limit },
    };
  }

  /** Write an audit log entry */
  async log(entry: AuditLogInput): Promise<void> {
    try {
      await (this.prisma as any).auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          actorUserId: entry.actorUserId,
          actorRole: entry.actorRole,
          actorTenantId: entry.actorTenantId,
          reason: entry.reason,
          previousVersion: entry.previousVersion ?? undefined,
          newVersion: entry.newVersion ?? undefined,
          dataClassification: entry.dataClassification ?? 'RESTRICTED',
          serviceName: entry.serviceName,
          ipAddress: entry.ipAddress,
        },
      });
    } catch {
      // Audit write failures are non-blocking
    }
  }
}
