// ═══════════════════════════════════════════════════════════════════
//  Audit Service — Immutable audit log for all hub operations
// ═══════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  HubAuditLog,
  AuditFilters,
  PaginatedResult,
  HubLogger,
} from './types';

export class AuditService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubAuditLog;
  }

  // ─── Log Action (immutable — no update/delete) ──────────────────

  async logAction(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorId: string,
    actorRole: string,
    details: Record<string, unknown> = {},
    ipAddress?: string,
  ): Promise<HubAuditLog> {
    const entry = await this.db.create({
      data: {
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        actor_id: actorId,
        actor_role: actorRole,
        details: details as any,
        ip_address: ipAddress ?? null,
      },
    });

    this.logger.info(
      `Audit: ${action} on ${entityType}/${entityId} by ${actorId} (${actorRole})`,
    );

    return entry as HubAuditLog;
  }

  // ─── Queries ────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    filters: AuditFilters = {},
  ): Promise<PaginatedResult<HubAuditLog>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.entity_id) where.entity_id = filters.entity_id;
    if (filters.action) where.action = filters.action;
    if (filters.actor_id) where.actor_id = filters.actor_id;
    if (filters.date_from || filters.date_to) {
      where.created_at = {
        ...(filters.date_from && { gte: filters.date_from }),
        ...(filters.date_to && { lte: filters.date_to }),
      };
    }

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubAuditLog[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get audit trail for a specific entity.
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResult<HubAuditLog>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const where = { entity_type: entityType, entity_id: entityId };

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubAuditLog[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get all actions performed by a specific actor.
   */
  async findByActor(
    actorId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResult<HubAuditLog>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const where = { actor_id: actorId };

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubAuditLog[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Count actions by type within a date range.
   * Useful for dashboard analytics.
   */
  async countByAction(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<Record<string, number>> {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (dateFrom || dateTo) {
      where.created_at = {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      };
    }

    const grouped = await this.db.groupBy({
      by: ['action'],
      where,
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const row of grouped) {
      result[row.action] = row._count.id;
    }
    return result;
  }
}
