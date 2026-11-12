import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { searchWords, wordIds, USER_WORD_SQL } from '../utils/text-search.js';

/** gte/lte bounds of the UUIDs starting with `prefix` (4+ chars of the text form), or null. */
function uuidPrefixRange(prefix: string): { gte: string; lte: string } | null {
  const LOW = '00000000-0000-0000-0000-000000000000';
  const HIGH = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  if (prefix.length < 4 || prefix.length > 36) return null;
  const gte = prefix + LOW.slice(prefix.length);
  const lte = prefix + HIGH.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(gte) ? { gte, lte } : null;
}

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

    const p = this.prisma as any;

    if (params.search) {
      // Every word must hit one displayed field. The audit log grows without
      // bound, so its own columns stay Prisma filters (no id lists from it);
      // only the small user table goes through the accent-folding SQL.
      const groups: Record<string, unknown>[] = [];
      for (const { word, raw } of searchWords(params.search)) {
        // The actor column shows the user's email / name, resolved from the user table
        const actorIds = await wordIds(this.prisma, USER_WORD_SQL, word);
        // entity_id is a UUID column (Prisma `contains` fails on it): the short id
        // shown in the table is a hex prefix, matched as a UUID range
        const entityRange = uuidPrefixRange(word);
        // Enum-like columns are matched word by word ("data steward" hits DATA_STEWARD)
        const texts = [...new Set([word, raw])];
        groups.push({
          OR: [
            ...texts.flatMap((t) => [
              { entityType: { contains: t, mode: 'insensitive' } },
              { action: { contains: t, mode: 'insensitive' } },
              { reason: { contains: t, mode: 'insensitive' } },
              { actorRole: { contains: t, mode: 'insensitive' } },
              { dataClassification: { contains: t, mode: 'insensitive' } },
              { serviceName: { contains: t, mode: 'insensitive' } },
            ]),
            ...(entityRange ? [{ entityId: entityRange }] : []),
            ...(actorIds.length > 0 ? [{ actorUserId: { in: actorIds } }] : []),
          ],
        });
      }
      if (groups.length > 0) where.AND = groups;
    }

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
