import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser, badRequest, notFound } from '../helpers';

export async function registerConnectionRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/connections';

  // ── POST /connections — Create connection ──
  app.post(prefix, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const body = request.body as {
      name: string;
      description?: string;
      system_type: string;
      system_name?: string;
      system_version?: string;
      country_code?: string;
      country_name?: string;
      organization?: string;
      base_url?: string;
      auth_type?: string;
      credentials?: Record<string, unknown>;
      headers?: Record<string, string>;
      tls_config?: Record<string, unknown>;
      direction: string;
      domains: string[];
      focal_technical?: Record<string, unknown>;
      focal_data_owner?: Record<string, unknown>;
      notes?: string;
      config?: Record<string, unknown>;
    };

    if (!body.name || !body.system_type || !body.direction || !Array.isArray(body.domains)) {
      throw badRequest('name, system_type, direction, and domains[] are required');
    }

    const connection = await app.prisma.hubConnection.create({
      data: {
        tenant_id: user.tenantId,
        name: body.name,
        description: body.description ?? null,
        system_type: body.system_type as any,
        system_name: body.system_name ?? null,
        system_version: body.system_version ?? null,
        country_code: body.country_code ?? null,
        country_name: body.country_name ?? null,
        organization: body.organization ?? null,
        base_url: body.base_url ?? null,
        auth_type: (body.auth_type as any) ?? 'NONE',
        credentials: body.credentials ?? {},
        headers: body.headers ?? {},
        tls_config: body.tls_config ?? undefined,
        direction: body.direction as any,
        domains: body.domains,
        focal_technical: body.focal_technical ?? undefined,
        focal_data_owner: body.focal_data_owner ?? undefined,
        notes: body.notes ?? null,
        config: body.config ?? {},
        created_by: user.userId,
      },
    });

    await app.hubAudit.log(user, 'connection', connection.id, 'CREATE', { name: body.name });

    return reply.code(201).send({ data: connection });
  });

  // ── GET /connections — List connections ──
  app.get(prefix, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    const direction = qs(request, 'direction');
    const status = qs(request, 'status');
    const countryCode = qs(request, 'country_code');
    const systemType = qs(request, 'system_type');

    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (countryCode) where.country_code = countryCode;
    if (systemType) where.system_type = systemType;

    const [data, total] = await Promise.all([
      app.prisma.hubConnection.findMany({ where: where as any, skip, take: limit, orderBy: { created_at: 'desc' } }),
      app.prisma.hubConnection.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── GET /connections/:id — Get connection detail ──
  app.get(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const connection = await app.prisma.hubConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
      include: {
        pipelines: { orderBy: { created_at: 'desc' } },
        schedules: true,
        _count: { select: { transactions: true, referential_mappings: true, field_mappings: true } },
      },
    });

    if (!connection) throw notFound('Connection');
    return { data: connection };
  });

  // ── PATCH /connections/:id — Update connection ──
  app.patch(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const existing = await app.prisma.hubConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Connection');

    // Strip read-only fields
    const { id: _, tenant_id: __, created_by: ___, created_at: ____, ...updates } = body;

    const updated = await app.prisma.hubConnection.update({
      where: { id },
      data: updates as any,
    });

    await app.hubAudit.log(user, 'connection', id, 'UPDATE', { fields: Object.keys(updates) });

    return { data: updated };
  });

  // ── DELETE /connections/:id — Delete connection (DRAFT only) ──
  app.delete(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Connection');
    if (existing.status !== 'DRAFT') {
      throw badRequest('Only DRAFT connections can be deleted');
    }

    await app.prisma.hubConnection.delete({ where: { id } });
    await app.hubAudit.log(user, 'connection', id, 'DELETE', { name: existing.name });

    return reply.code(204).send();
  });

  // ── POST /connections/:id/activate — Activate connection ──
  app.post(`${prefix}/:id/activate`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Connection');
    if (existing.status === 'ACTIVE') {
      return { data: existing, message: 'Connection is already active' };
    }

    const updated = await app.prisma.hubConnection.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await app.hubAudit.log(user, 'connection', id, 'ACTIVATE', { previousStatus: existing.status });

    return { data: updated };
  });

  // ── POST /connections/:id/suspend — Suspend connection ──
  app.post(`${prefix}/:id/suspend`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Connection');

    const updated = await app.prisma.hubConnection.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await app.hubAudit.log(user, 'connection', id, 'SUSPEND', { previousStatus: existing.status });

    return { data: updated };
  });

  // ── POST /connections/:id/test — Test connection health check ──
  app.post(`${prefix}/:id/test`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubConnection.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Connection');

    // Perform health check
    let healthOk = false;
    let healthMessage = 'No base_url configured';
    let responseTimeMs: number | null = null;
    let statusCode: number | null = null;

    if (existing.base_url) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(existing.base_url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        responseTimeMs = Date.now() - start;
        statusCode = res.status;
        healthOk = res.ok;
        healthMessage = healthOk ? 'Connection successful' : `HTTP ${res.status} ${res.statusText}`;
      } catch (err: any) {
        responseTimeMs = Date.now() - start;
        healthMessage = err.name === 'AbortError' ? 'Connection timed out (10s)' : `Connection failed: ${err.message}`;
      }
    }

    // Persist health check
    await app.prisma.hubHealthCheck.create({
      data: {
        connection_id: id,
        status: healthOk ? 'UP' : 'DOWN',
        response_time_ms: responseTimeMs,
        status_code: statusCode,
        error_message: healthOk ? null : healthMessage,
      },
    });

    // Update connection health fields
    await app.prisma.hubConnection.update({
      where: { id },
      data: {
        last_health_at: new Date(),
        last_health_ok: healthOk,
        health_message: healthMessage,
      },
    });

    await app.hubAudit.log(user, 'connection', id, 'HEALTH_CHECK', { ok: healthOk, ms: responseTimeMs });

    return {
      data: {
        connection_id: id,
        status: healthOk ? 'UP' : 'DOWN',
        response_time_ms: responseTimeMs,
        status_code: statusCode,
        message: healthMessage,
        checked_at: new Date().toISOString(),
      },
    };
  });
}
