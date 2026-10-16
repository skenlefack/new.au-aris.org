import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser, badRequest, notFound } from '../helpers';

export async function registerScheduleRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/schedules';

  // ── POST /schedules — Create schedule ──
  app.post(prefix, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const body = request.body as {
      connection_id: string;
      pipeline_id?: string;
      frequency: string;
      cron_expression?: string;
      timezone?: string;
      window_start?: string;
      window_end?: string;
      period_type?: string;
      period_start?: string;
      period_end?: string;
    };

    if (!body.connection_id || !body.frequency) {
      throw badRequest('connection_id and frequency are required');
    }

    // Verify connection
    const connection = await app.prisma.hubConnection.findFirst({
      where: { id: body.connection_id, tenant_id: user.tenantId },
    });
    if (!connection) throw notFound('Connection');

    // Verify pipeline if provided
    if (body.pipeline_id) {
      const pipeline = await app.prisma.hubPipeline.findFirst({
        where: { id: body.pipeline_id, connection_id: body.connection_id },
      });
      if (!pipeline) throw notFound('Pipeline');
    }

    const schedule = await app.prisma.hubSchedule.create({
      data: {
        connection_id: body.connection_id,
        pipeline_id: body.pipeline_id ?? null,
        tenant_id: user.tenantId,
        frequency: body.frequency as any,
        cron_expression: body.cron_expression ?? null,
        timezone: body.timezone ?? 'UTC',
        window_start: body.window_start ?? null,
        window_end: body.window_end ?? null,
        period_type: body.period_type ?? null,
        period_start: body.period_start ? new Date(body.period_start) : null,
        period_end: body.period_end ? new Date(body.period_end) : null,
        is_active: false, // Start inactive; activate explicitly
      },
    });

    await app.hubAudit.log(user, 'schedule', schedule.id, 'CREATE', {
      connectionId: body.connection_id,
      frequency: body.frequency,
    });

    return reply.code(201).send({ data: schedule });
  });

  // ── GET /schedules — List schedules ──
  app.get(prefix, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    const connectionId = qs(request, 'connection_id');
    const isActive = qs(request, 'is_active');

    if (connectionId) where.connection_id = connectionId;
    if (isActive !== undefined) where.is_active = isActive === 'true';

    const [data, total] = await Promise.all([
      app.prisma.hubSchedule.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          connection: { select: { id: true, name: true, country_code: true } },
        },
      }),
      app.prisma.hubSchedule.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── PATCH /schedules/:id — Update schedule ──
  app.patch(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const existing = await app.prisma.hubSchedule.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Schedule');

    const { id: _, tenant_id: __, connection_id: ___, created_at: ____, ...updates } = body;

    // Convert date strings
    if (typeof updates.period_start === 'string') updates.period_start = new Date(updates.period_start as string);
    if (typeof updates.period_end === 'string') updates.period_end = new Date(updates.period_end as string);

    const updated = await app.prisma.hubSchedule.update({
      where: { id },
      data: updates as any,
    });

    await app.hubAudit.log(user, 'schedule', id, 'UPDATE', { fields: Object.keys(updates) });

    return { data: updated };
  });

  // ── DELETE /schedules/:id — Delete schedule ──
  app.delete(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubSchedule.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Schedule');

    await app.prisma.hubSchedule.delete({ where: { id } });
    await app.hubAudit.log(user, 'schedule', id, 'DELETE', { connectionId: existing.connection_id });

    return reply.code(204).send();
  });

  // ── POST /schedules/:id/activate — Activate schedule ──
  app.post(`${prefix}/:id/activate`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubSchedule.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Schedule');

    const updated = await app.prisma.hubSchedule.update({
      where: { id },
      data: { is_active: true },
    });

    await app.hubAudit.log(user, 'schedule', id, 'ACTIVATE', {});

    return { data: updated };
  });

  // ── POST /schedules/:id/pause — Pause schedule ──
  app.post(`${prefix}/:id/pause`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubSchedule.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Schedule');

    const updated = await app.prisma.hubSchedule.update({
      where: { id },
      data: { is_active: false },
    });

    await app.hubAudit.log(user, 'schedule', id, 'PAUSE', {});

    return { data: updated };
  });
}
