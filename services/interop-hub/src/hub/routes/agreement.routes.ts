import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser, badRequest, notFound } from '../helpers';

/** Generate a unique agreement reference: HUB-YYYY-NNNNN */
function generateReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `HUB-${year}-${seq}`;
}

export async function registerAgreementRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/agreements';

  // ── POST /agreements — Create agreement ──
  app.post(prefix, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const body = request.body as {
      connection_id: string;
      title: string;
      description?: string;
      purpose?: string;
      legal_basis?: string;
      partner_tenant_id?: string;
      partner_name: string;
      domains: string[];
      direction: string;
      data_scope?: Record<string, unknown>;
      data_classification?: string;
      frequency?: string;
      timeliness_sla_hours?: number;
      quality_min_score?: number;
      valid_from?: string;
      valid_until?: string;
    };

    if (!body.connection_id || !body.title || !body.partner_name || !body.direction) {
      throw badRequest('connection_id, title, partner_name, and direction are required');
    }

    // Verify connection
    const connection = await app.prisma.hubConnection.findFirst({
      where: { id: body.connection_id, tenant_id: user.tenantId },
    });
    if (!connection) throw notFound('Connection');

    // Generate unique reference (retry on collision)
    let reference = generateReference();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await app.prisma.hubAgreement.findUnique({ where: { reference } });
      if (!exists) break;
      reference = generateReference();
      attempts++;
    }

    const agreement = await app.prisma.hubAgreement.create({
      data: {
        connection_id: body.connection_id,
        reference,
        tenant_id: user.tenantId,
        owner_tenant_id: user.tenantId,
        owner_name: (user as any).tenantName ?? 'AU-IBAR',
        partner_tenant_id: body.partner_tenant_id ?? null,
        partner_name: body.partner_name,
        title: body.title,
        description: body.description ?? null,
        purpose: body.purpose ?? null,
        legal_basis: body.legal_basis ?? null,
        domains: body.domains ?? [],
        direction: body.direction as any,
        data_scope: body.data_scope ?? undefined,
        data_classification: body.data_classification ?? null,
        frequency: body.frequency as any ?? undefined,
        timeliness_sla_hours: body.timeliness_sla_hours ?? null,
        quality_min_score: body.quality_min_score ?? null,
        valid_from: body.valid_from ? new Date(body.valid_from) : null,
        valid_until: body.valid_until ? new Date(body.valid_until) : null,
        created_by: user.userId,
      },
    });

    await app.hubAudit.log(user, 'agreement', agreement.id, 'CREATE', { reference, title: body.title });

    return reply.code(201).send({ data: agreement });
  });

  // ── GET /agreements — List agreements ──
  app.get(prefix, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    const status = qs(request, 'status');
    const connectionId = qs(request, 'connection_id');

    if (status) where.status = status;
    if (connectionId) where.connection_id = connectionId;

    const [data, total] = await Promise.all([
      app.prisma.hubAgreement.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          connection: { select: { id: true, name: true, country_code: true } },
        },
      }),
      app.prisma.hubAgreement.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── GET /agreements/:id — Get agreement detail ──
  app.get(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const agreement = await app.prisma.hubAgreement.findFirst({
      where: { id, tenant_id: user.tenantId },
      include: {
        connection: { select: { id: true, name: true, country_code: true, system_type: true, direction: true } },
      },
    });

    if (!agreement) throw notFound('Agreement');
    return { data: agreement };
  });

  // ── PATCH /agreements/:id — Update agreement (DRAFT only) ──
  app.patch(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const existing = await app.prisma.hubAgreement.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Agreement');
    if (existing.status !== 'DRAFT') {
      throw badRequest('Only DRAFT agreements can be updated. Use workflow actions to change status.');
    }

    const { id: _, tenant_id: __, reference: ___, created_by: ____, created_at: _____, ...updates } = body;

    // Convert date strings
    if (typeof updates.valid_from === 'string') updates.valid_from = new Date(updates.valid_from as string);
    if (typeof updates.valid_until === 'string') updates.valid_until = new Date(updates.valid_until as string);

    const updated = await app.prisma.hubAgreement.update({
      where: { id },
      data: updates as any,
    });

    await app.hubAudit.log(user, 'agreement', id, 'UPDATE', { fields: Object.keys(updates) });

    return { data: updated };
  });

  // ── POST /agreements/:id/propose — Submit for review ──
  app.post(`${prefix}/:id/propose`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubAgreement.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Agreement');
    if (existing.status !== 'DRAFT') {
      throw badRequest('Only DRAFT agreements can be proposed');
    }

    const updated = await app.prisma.hubAgreement.update({
      where: { id },
      data: { status: 'PROPOSED', proposed_at: new Date() },
    });

    await app.hubAudit.log(user, 'agreement', id, 'PROPOSE', {});

    return { data: updated };
  });

  // ── POST /agreements/:id/accept — Accept agreement ──
  app.post(`${prefix}/:id/accept`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubAgreement.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Agreement');
    if (!['PROPOSED', 'UNDER_REVIEW'].includes(existing.status)) {
      throw badRequest('Agreement must be in PROPOSED or UNDER_REVIEW status to accept');
    }

    const updated = await app.prisma.hubAgreement.update({
      where: { id },
      data: { status: 'ACTIVE', accepted_at: new Date() },
    });

    await app.hubAudit.log(user, 'agreement', id, 'ACCEPT', {});

    return { data: updated };
  });

  // ── POST /agreements/:id/reject — Reject agreement ──
  app.post(`${prefix}/:id/reject`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = (request.body as { reason?: string } | null) ?? {};

    const existing = await app.prisma.hubAgreement.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Agreement');
    if (!['PROPOSED', 'UNDER_REVIEW'].includes(existing.status)) {
      throw badRequest('Agreement must be in PROPOSED or UNDER_REVIEW status to reject');
    }

    const updated = await app.prisma.hubAgreement.update({
      where: { id },
      data: { status: 'REJECTED', rejected_at: new Date() },
    });

    await app.hubAudit.log(user, 'agreement', id, 'REJECT', { reason: body.reason });

    return { data: updated };
  });

  // ── POST /agreements/:id/revoke — Revoke agreement ──
  app.post(`${prefix}/:id/revoke`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = (request.body as { reason?: string } | null) ?? {};

    const existing = await app.prisma.hubAgreement.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Agreement');
    if (!['ACTIVE', 'ACCEPTED'].includes(existing.status)) {
      throw badRequest('Only ACTIVE or ACCEPTED agreements can be revoked');
    }

    const updated = await app.prisma.hubAgreement.update({
      where: { id },
      data: { status: 'REVOKED', revoked_at: new Date() },
    });

    await app.hubAudit.log(user, 'agreement', id, 'REVOKE', { reason: body.reason });

    return { data: updated };
  });
}
