import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import {
  TOPIC_SYS_SUPPORT_TICKET_CREATED,
  TOPIC_SYS_SUPPORT_TICKET_UPDATED,
  TOPIC_SYS_SUPPORT_TICKET_CLOSED,
  TOPIC_SYS_SUPPORT_TICKET_ASSIGNED,
  TOPIC_SYS_SUPPORT_TICKET_ESCALATED,
  TOPIC_SYS_SUPPORT_SLA_BREACHED,
} from '@aris/shared-types';
import type {
  CreateTicketDto,
  UpdateTicketDto,
  AddCommentDto,
  ListQuery,
  EscalateDto,
  SlaStatsQuery,
} from '../schemas/support.schema';

const SERVICE_NAME = 'support-service';
const CACHE_TTL = 300; // 5 min

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// SLA deadlines in hours by category × priority
const SLA_MATRIX: Record<string, Record<string, { response: number; resolution: number }>> = {
  TECHNICAL:    { CRITICAL: { response: 1, resolution: 4 },   HIGH: { response: 2, resolution: 8 },   MEDIUM: { response: 4, resolution: 24 },  LOW: { response: 8, resolution: 72 } },
  DATA_QUALITY: { CRITICAL: { response: 2, resolution: 8 },   HIGH: { response: 4, resolution: 24 },  MEDIUM: { response: 8, resolution: 48 },  LOW: { response: 24, resolution: 120 } },
  ACCESS:       { CRITICAL: { response: 1, resolution: 2 },   HIGH: { response: 2, resolution: 4 },   MEDIUM: { response: 4, resolution: 24 },  LOW: { response: 8, resolution: 48 } },
  GENERAL:      { CRITICAL: { response: 2, resolution: 8 },   HIGH: { response: 4, resolution: 24 },  MEDIUM: { response: 8, resolution: 48 },  LOW: { response: 24, resolution: 120 } },
};

export class SupportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  // ── Auto-reference: SUP-YYYY-NNNNN ──
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const key = `aris:support:ref:${year}`;
    const seq = await this.redis.incr(key);
    // Set TTL to expire at end of year if it's a new key
    if (seq === 1) {
      const endOfYear = new Date(year + 1, 0, 1);
      const ttl = Math.ceil((endOfYear.getTime() - Date.now()) / 1000);
      await this.redis.expire(key, ttl);
    }
    return `SUP-${year}-${String(seq).padStart(5, '0')}`;
  }

  // ── SLA calculation ──
  private calculateSLA(category: string, priority: string): { deadline: Date; responseTarget: Date } {
    const sla = SLA_MATRIX[category]?.[priority] ?? { response: 24, resolution: 120 };
    const now = new Date();
    return {
      responseTarget: new Date(now.getTime() + sla.response * 3600_000),
      deadline: new Date(now.getTime() + sla.resolution * 3600_000),
    };
  }

  async createTicket(dto: CreateTicketDto, tenantId: string, userId: string) {
    const id = randomUUID();
    const reference = await this.generateReference();
    const { deadline, responseTarget } = this.calculateSLA(dto.category, dto.priority);

    const ticket = await (this.prisma as any).ticket.create({
      data: {
        id,
        reference,
        tenant_id: tenantId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        status: 'OPEN',
        created_by: userId,
        sla_deadline: deadline,
        attachment_keys: dto.attachmentKeys ?? [],
        sla: {
          create: {
            id: randomUUID(),
            category: dto.category,
            priority: dto.priority,
            deadline,
            response_target: responseTarget,
          },
        },
      },
      include: { sla: true },
    });

    await this.invalidateListCache(tenantId);
    await this.publishEvent(TOPIC_SYS_SUPPORT_TICKET_CREATED, id, ticket, tenantId, userId);
    return { data: ticket };
  }

  async listTickets(tenantId: string, query: ListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortField = query.sort ?? 'created_at';
    const orderBy = { [sortField]: query.order ?? 'desc' };

    const where: any = { tenant_id: tenantId, deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;

    const cacheKey = `aris:support:tickets:${tenantId}:${JSON.stringify({ ...query, page, limit })}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [data, total] = await Promise.all([
      (this.prisma as any).ticket.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).ticket.count({ where }),
    ]);

    const result = { data, meta: { total, page, limit } };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  }

  async getTicket(id: string, tenantId: string) {
    const cacheKey = `aris:support:ticket:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { data: JSON.parse(cached) };

    const ticket = await (this.prisma as any).ticket.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { comments: true, sla: true },
    });
    if (!ticket) throw new HttpError(404, 'Support ticket not found');

    await this.redis.set(cacheKey, JSON.stringify(ticket), 'EX', CACHE_TTL);
    return { data: ticket };
  }

  async updateTicket(id: string, dto: UpdateTicketDto, tenantId: string, userId: string) {
    const existing = await (this.prisma as any).ticket.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
    if (!existing) throw new HttpError(404, 'Support ticket not found');

    const updateData: any = {};
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === 'RESOLVED') updateData.resolved_at = new Date();
      if (dto.status === 'CLOSED') updateData.closed_at = new Date();
    }
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.assignedTo !== undefined) updateData.assigned_to = dto.assignedTo;

    const ticket = await (this.prisma as any).ticket.update({
      where: { id },
      data: updateData,
    });

    await this.redis.del(`aris:support:ticket:${id}`);
    await this.invalidateListCache(tenantId);

    // Publish appropriate events
    if (dto.assignedTo && dto.assignedTo !== existing.assigned_to) {
      await this.publishEvent(TOPIC_SYS_SUPPORT_TICKET_ASSIGNED, id, ticket, tenantId, userId);
    }
    await this.publishEvent(TOPIC_SYS_SUPPORT_TICKET_UPDATED, id, ticket, tenantId, userId);

    if (dto.status === 'CLOSED') {
      await this.publishEvent(TOPIC_SYS_SUPPORT_TICKET_CLOSED, id, ticket, tenantId, userId);
    }

    return { data: ticket };
  }

  async escalateTicket(id: string, dto: EscalateDto, tenantId: string, userId: string) {
    const existing = await (this.prisma as any).ticket.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
    if (!existing) throw new HttpError(404, 'Support ticket not found');
    if (existing.status === 'CLOSED' || existing.status === 'RESOLVED') {
      throw new HttpError(400, 'Cannot escalate a resolved or closed ticket');
    }

    const ticket = await (this.prisma as any).ticket.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        escalated_to: dto.targetTenantId,
      },
    });

    // Add escalation comment
    await (this.prisma as any).ticketComment.create({
      data: {
        id: randomUUID(),
        ticket_id: id,
        content: `Ticket escalated to tenant ${dto.targetTenantId}. Reason: ${dto.reason ?? 'No reason provided'}`,
        is_internal: true,
        created_by: userId,
      },
    });

    await this.redis.del(`aris:support:ticket:${id}`);
    await this.invalidateListCache(tenantId);
    await this.publishEvent(TOPIC_SYS_SUPPORT_TICKET_ESCALATED, id, { ...ticket, reason: dto.reason }, tenantId, userId);

    return { data: ticket };
  }

  async addComment(ticketId: string, dto: AddCommentDto, tenantId: string, userId: string) {
    const ticket = await (this.prisma as any).ticket.findFirst({
      where: { id: ticketId, tenant_id: tenantId, deleted_at: null },
    });
    if (!ticket) throw new HttpError(404, 'Support ticket not found');

    const id = randomUUID();
    const comment = await (this.prisma as any).ticketComment.create({
      data: {
        id,
        ticket_id: ticketId,
        content: dto.content,
        is_internal: dto.isInternal ?? false,
        created_by: userId,
      },
    });

    // Mark SLA response if this is the first response
    const sla = await (this.prisma as any).ticketSLA.findFirst({
      where: { ticket_id: ticketId, responded_at: null },
    });
    if (sla) {
      const now = new Date();
      await (this.prisma as any).ticketSLA.update({
        where: { id: sla.id },
        data: { responded_at: now },
      });
    }

    await this.redis.del(`aris:support:ticket:${ticketId}`);
    return { data: comment };
  }

  async listComments(ticketId: string, tenantId: string) {
    const ticket = await (this.prisma as any).ticket.findFirst({
      where: { id: ticketId, tenant_id: tenantId, deleted_at: null },
    });
    if (!ticket) throw new HttpError(404, 'Support ticket not found');

    const comments = await (this.prisma as any).ticketComment.findMany({
      where: { ticket_id: ticketId },
      orderBy: { created_at: 'asc' },
    });
    return { data: comments };
  }

  async checkSlaBreaches(): Promise<number> {
    const now = new Date();
    const breached = await (this.prisma as any).ticket.findMany({
      where: {
        sla_breached: false,
        sla_deadline: { lte: now },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        deleted_at: null,
      },
    });

    for (const ticket of breached) {
      await (this.prisma as any).ticket.update({
        where: { id: ticket.id },
        data: { sla_breached: true },
      });
      await (this.prisma as any).ticketSLA.updateMany({
        where: { ticket_id: ticket.id },
        data: { breached: true, breached_at: now },
      });
      await this.publishEvent(TOPIC_SYS_SUPPORT_SLA_BREACHED, ticket.id, ticket, ticket.tenant_id, 'system');
    }

    return breached.length;
  }

  async getSlaStats(tenantId: string, query: SlaStatsQuery) {
    const periodDays = query.period === '7d' ? 7 : query.period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - periodDays * 86400_000);

    const [total, breached, resolved, avgResolutionTime] = await Promise.all([
      (this.prisma as any).ticket.count({
        where: { tenant_id: tenantId, created_at: { gte: since }, deleted_at: null },
      }),
      (this.prisma as any).ticket.count({
        where: { tenant_id: tenantId, sla_breached: true, created_at: { gte: since }, deleted_at: null },
      }),
      (this.prisma as any).ticket.count({
        where: { tenant_id: tenantId, status: { in: ['RESOLVED', 'CLOSED'] }, created_at: { gte: since }, deleted_at: null },
      }),
      this.calculateAvgResolutionTime(tenantId, since),
    ]);

    return {
      data: {
        period: query.period ?? '30d',
        total,
        breached,
        resolved,
        slaComplianceRate: total > 0 ? ((total - breached) / total * 100).toFixed(1) : '100.0',
        avgResolutionHours: avgResolutionTime,
      },
    };
  }

  private async calculateAvgResolutionTime(tenantId: string, since: Date): Promise<number> {
    const resolved = await (this.prisma as any).ticket.findMany({
      where: {
        tenant_id: tenantId,
        resolved_at: { not: null },
        created_at: { gte: since },
        deleted_at: null,
      },
      select: { created_at: true, resolved_at: true },
    });

    if (resolved.length === 0) return 0;

    const totalHours = resolved.reduce((sum: number, t: any) => {
      const diff = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      return sum + diff / 3600_000;
    }, 0);

    return Math.round((totalHours / resolved.length) * 10) / 10;
  }

  private async invalidateListCache(tenantId: string): Promise<void> {
    const pattern = `aris:support:tickets:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch {}
  }
}
