import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser, badRequest, notFound, forbidden } from '../helpers';

export async function registerTransactionRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/transactions';

  // ── GET /transactions — List transactions ──
  app.get(prefix, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    const direction = qs(request, 'direction');
    const status = qs(request, 'status');
    const domain = qs(request, 'domain');
    const connectionId = qs(request, 'connection_id');
    const dateFrom = qs(request, 'date_from');
    const dateTo = qs(request, 'date_to');

    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (domain) where.domain = domain;
    if (connectionId) where.connection_id = connectionId;
    if (dateFrom || dateTo) {
      where.created_at = {} as Record<string, Date>;
      if (dateFrom) (where.created_at as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.created_at as Record<string, Date>).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      app.prisma.hubTransaction.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          connection: { select: { id: true, name: true, country_code: true, system_type: true } },
          pipeline: { select: { id: true, name: true, domain: true } },
        },
      }),
      app.prisma.hubTransaction.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── GET /transactions/:id — Get transaction detail ──
  app.get(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const transaction = await app.prisma.hubTransaction.findFirst({
      where: { id, tenant_id: user.tenantId },
      include: {
        connection: { select: { id: true, name: true, country_code: true, system_type: true } },
        pipeline: { select: { id: true, name: true, domain: true, direction: true } },
        records: { orderBy: { record_index: 'asc' }, take: 200 },
        steps_log: { orderBy: { step_order: 'asc' } },
      },
    });

    if (!transaction) throw notFound('Transaction');
    return { data: transaction };
  });

  // ── POST /transactions/:id/approve — Approve transaction (MANUAL mode) ──
  app.post(`${prefix}/:id/approve`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = (request.body as { notes?: string } | null) ?? {};

    const transaction = await app.prisma.hubTransaction.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!transaction) throw notFound('Transaction');

    if (transaction.mode !== 'MANUAL') {
      throw badRequest('Only MANUAL mode transactions require approval');
    }
    if (transaction.status !== 'AWAITING_REVIEW') {
      throw badRequest(`Transaction must be in AWAITING_REVIEW status (current: ${transaction.status})`);
    }

    const updated = await app.prisma.hubTransaction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewed_by: user.userId,
        reviewed_at: new Date(),
        review_notes: body.notes ?? null,
      },
    });

    await app.hubAudit.log(user, 'transaction', id, 'APPROVE', { notes: body.notes });

    // TODO: Resume pipeline execution after approval

    return { data: updated };
  });

  // ── POST /transactions/:id/reject — Reject transaction (MANUAL mode) ──
  app.post(`${prefix}/:id/reject`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = (request.body as { notes?: string; reason?: string } | null) ?? {};

    const transaction = await app.prisma.hubTransaction.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!transaction) throw notFound('Transaction');

    if (transaction.mode !== 'MANUAL') {
      throw badRequest('Only MANUAL mode transactions can be rejected');
    }
    if (transaction.status !== 'AWAITING_REVIEW') {
      throw badRequest(`Transaction must be in AWAITING_REVIEW status (current: ${transaction.status})`);
    }

    const updated = await app.prisma.hubTransaction.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewed_by: user.userId,
        reviewed_at: new Date(),
        review_notes: body.notes ?? body.reason ?? null,
      },
    });

    await app.hubAudit.log(user, 'transaction', id, 'REJECT', { notes: body.notes ?? body.reason });

    return { data: updated };
  });

  // ── POST /transactions/:id/retry — Retry failed transaction ──
  app.post(`${prefix}/:id/retry`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const transaction = await app.prisma.hubTransaction.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!transaction) throw notFound('Transaction');

    if (!['FAILED', 'PARTIAL'].includes(transaction.status)) {
      throw badRequest(`Only FAILED or PARTIAL transactions can be retried (current: ${transaction.status})`);
    }
    if (transaction.retry_count >= transaction.max_retries) {
      throw badRequest(`Maximum retries (${transaction.max_retries}) exceeded`);
    }

    const updated = await app.prisma.hubTransaction.update({
      where: { id },
      data: {
        status: 'RETRY',
        retry_count: { increment: 1 },
        error_message: null,
      },
    });

    await app.hubAudit.log(user, 'transaction', id, 'RETRY', { retryCount: updated.retry_count });

    // TODO: Enqueue retry via Kafka or in-process engine

    return { data: updated, message: 'Transaction queued for retry' };
  });

  // ── POST /transactions/:id/cancel — Cancel transaction ──
  app.post(`${prefix}/:id/cancel`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const transaction = await app.prisma.hubTransaction.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!transaction) throw notFound('Transaction');

    const terminalStatuses = ['COMPLETED', 'CANCELLED'];
    if (terminalStatuses.includes(transaction.status)) {
      throw badRequest(`Transaction in ${transaction.status} status cannot be cancelled`);
    }

    const updated = await app.prisma.hubTransaction.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completed_at: new Date(),
      },
    });

    await app.hubAudit.log(user, 'transaction', id, 'CANCEL', {});

    return { data: updated };
  });

  // ── GET /inbox — Inbound transactions awaiting review ──
  app.get('/api/v1/hub/inbox', {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where = {
      tenant_id: user.tenantId,
      direction: 'INBOUND' as const,
      status: 'AWAITING_REVIEW' as const,
    };

    const [data, total] = await Promise.all([
      app.prisma.hubTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          connection: { select: { id: true, name: true, country_code: true, system_type: true } },
          pipeline: { select: { id: true, name: true, domain: true } },
        },
      }),
      app.prisma.hubTransaction.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── GET /outbox — Outbound transactions awaiting review ──
  app.get('/api/v1/hub/outbox', {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where = {
      tenant_id: user.tenantId,
      direction: 'OUTBOUND' as const,
      status: 'AWAITING_REVIEW' as const,
    };

    const [data, total] = await Promise.all([
      app.prisma.hubTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          connection: { select: { id: true, name: true, country_code: true, system_type: true } },
          pipeline: { select: { id: true, name: true, domain: true } },
        },
      }),
      app.prisma.hubTransaction.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });
}
