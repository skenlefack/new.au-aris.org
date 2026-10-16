import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser, badRequest, notFound } from '../helpers';

export async function registerPipelineRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/pipelines';

  // ── POST /pipelines — Create pipeline ──
  app.post(prefix, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const body = request.body as {
      connection_id: string;
      name: string;
      description?: string;
      direction: string;
      domain: string;
      sub_domain?: string;
      entity_type?: string;
      mode?: string;
      target_campaign_id?: string;
      target_form_id?: string;
      target_workflow_id?: string;
      export_format?: string;
      quality_gates_enabled?: boolean;
      min_quality_score?: number;
      reject_on_quality_fail?: boolean;
      max_retries?: number;
      retry_delay_ms?: number;
      dlq_enabled?: boolean;
      steps?: Array<{
        step_order: number;
        step_type: string;
        name: string;
        description?: string;
        is_enabled?: boolean;
        config?: Record<string, unknown>;
        on_error?: string;
        timeout_ms?: number;
      }>;
    };

    if (!body.connection_id || !body.name || !body.direction || !body.domain) {
      throw badRequest('connection_id, name, direction, and domain are required');
    }

    // Verify connection belongs to tenant
    const connection = await app.prisma.hubConnection.findFirst({
      where: { id: body.connection_id, tenant_id: user.tenantId },
    });
    if (!connection) throw notFound('Connection');

    const pipeline = await app.prisma.hubPipeline.create({
      data: {
        connection_id: body.connection_id,
        tenant_id: user.tenantId,
        name: body.name,
        description: body.description ?? null,
        direction: body.direction as any,
        domain: body.domain,
        sub_domain: body.sub_domain ?? null,
        entity_type: body.entity_type ?? null,
        mode: (body.mode as any) ?? 'MANUAL',
        target_campaign_id: body.target_campaign_id ?? null,
        target_form_id: body.target_form_id ?? null,
        target_workflow_id: body.target_workflow_id ?? null,
        export_format: body.export_format as any ?? undefined,
        quality_gates_enabled: body.quality_gates_enabled ?? true,
        min_quality_score: body.min_quality_score ?? 0.7,
        reject_on_quality_fail: body.reject_on_quality_fail ?? false,
        max_retries: body.max_retries ?? 3,
        retry_delay_ms: body.retry_delay_ms ?? 60000,
        dlq_enabled: body.dlq_enabled ?? true,
        created_by: user.userId,
        steps: body.steps?.length ? {
          create: body.steps.map((s) => ({
            step_order: s.step_order,
            step_type: s.step_type as any,
            name: s.name,
            description: s.description ?? null,
            is_enabled: s.is_enabled ?? true,
            config: s.config ?? {},
            on_error: s.on_error ?? 'STOP',
            timeout_ms: s.timeout_ms ?? 30000,
          })),
        } : undefined,
      },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    await app.hubAudit.log(user, 'pipeline', pipeline.id, 'CREATE', { name: body.name, domain: body.domain });

    return reply.code(201).send({ data: pipeline });
  });

  // ── GET /pipelines — List pipelines ──
  app.get(prefix, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { page, limit, skip } = parsePagination(request);

    const where: Record<string, unknown> = { tenant_id: user.tenantId };
    const connectionId = qs(request, 'connection_id');
    const direction = qs(request, 'direction');
    const domain = qs(request, 'domain');
    const status = qs(request, 'status');

    if (connectionId) where.connection_id = connectionId;
    if (direction) where.direction = direction;
    if (domain) where.domain = domain;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      app.prisma.hubPipeline.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { connection: { select: { id: true, name: true, country_code: true, system_type: true } } },
      }),
      app.prisma.hubPipeline.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── GET /pipelines/:id — Get pipeline detail (includes steps) ──
  app.get(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const pipeline = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
      include: {
        steps: { orderBy: { step_order: 'asc' } },
        connection: { select: { id: true, name: true, country_code: true, system_type: true, direction: true } },
        _count: { select: { transactions: true } },
      },
    });

    if (!pipeline) throw notFound('Pipeline');
    return { data: pipeline };
  });

  // ── PATCH /pipelines/:id — Update pipeline ──
  app.patch(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const existing = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Pipeline');

    const { id: _, tenant_id: __, connection_id: ___, created_by: ____, created_at: _____, steps: ______, ...updates } = body;

    const updated = await app.prisma.hubPipeline.update({
      where: { id },
      data: updates as any,
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    await app.hubAudit.log(user, 'pipeline', id, 'UPDATE', { fields: Object.keys(updates) });

    return { data: updated };
  });

  // ── DELETE /pipelines/:id — Delete pipeline (DRAFT only) ──
  app.delete(`${prefix}/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Pipeline');
    if (existing.status !== 'DRAFT') {
      throw badRequest('Only DRAFT pipelines can be deleted');
    }

    await app.prisma.hubPipeline.delete({ where: { id } });
    await app.hubAudit.log(user, 'pipeline', id, 'DELETE', { name: existing.name });

    return reply.code(204).send();
  });

  // ── POST /pipelines/:id/activate — Activate pipeline ──
  app.post(`${prefix}/:id/activate`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Pipeline');

    const updated = await app.prisma.hubPipeline.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await app.hubAudit.log(user, 'pipeline', id, 'ACTIVATE', { previousStatus: existing.status });

    return { data: updated };
  });

  // ── POST /pipelines/:id/pause — Pause pipeline ──
  app.post(`${prefix}/:id/pause`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Pipeline');

    const updated = await app.prisma.hubPipeline.update({
      where: { id },
      data: { status: 'PAUSED' },
    });

    await app.hubAudit.log(user, 'pipeline', id, 'PAUSE', { previousStatus: existing.status });

    return { data: updated };
  });

  // ── POST /pipelines/:id/execute — Manually trigger pipeline execution ──
  app.post(`${prefix}/:id/execute`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = (request.body as { payload?: unknown; records?: unknown[] } | null) ?? {};

    const pipeline = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
      include: { connection: true, steps: { orderBy: { step_order: 'asc' } } },
    });
    if (!pipeline) throw notFound('Pipeline');
    if (pipeline.status !== 'ACTIVE') {
      throw badRequest('Pipeline must be ACTIVE to execute');
    }

    // Create a transaction record for this execution
    const transaction = await app.prisma.hubTransaction.create({
      data: {
        pipeline_id: id,
        connection_id: pipeline.connection_id,
        tenant_id: user.tenantId,
        direction: pipeline.direction,
        status: 'QUEUED',
        mode: pipeline.mode,
        domain: pipeline.domain,
        entity_type: pipeline.entity_type,
        country_code: pipeline.connection.country_code,
        target_campaign_id: pipeline.target_campaign_id,
        target_form_id: pipeline.target_form_id,
        export_format: pipeline.export_format,
        source_payload: body.payload ?? body.records ?? null,
        max_retries: pipeline.max_retries,
        initiated_by: user.userId,
      },
    });

    // Increment total_runs
    await app.prisma.hubPipeline.update({
      where: { id },
      data: { total_runs: { increment: 1 }, last_run_at: new Date(), last_run_status: 'QUEUED' },
    });

    await app.hubAudit.log(user, 'pipeline', id, 'EXECUTE', { transactionId: transaction.id });

    // TODO: Enqueue pipeline execution via Kafka or in-process engine
    // For now, return the transaction to track status
    return reply.code(202).send({
      data: transaction,
      message: 'Pipeline execution queued',
    });
  });

  // ── PUT /pipelines/:id/steps — Replace all steps ──
  app.put(`${prefix}/:id/steps`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      steps: Array<{
        step_order: number;
        step_type: string;
        name: string;
        description?: string;
        is_enabled?: boolean;
        config?: Record<string, unknown>;
        on_error?: string;
        timeout_ms?: number;
      }>;
    };

    if (!Array.isArray(body.steps)) {
      throw badRequest('steps[] array is required');
    }

    const existing = await app.prisma.hubPipeline.findFirst({
      where: { id, tenant_id: user.tenantId },
    });
    if (!existing) throw notFound('Pipeline');

    // Replace all steps in a transaction
    await app.prisma.$transaction([
      app.prisma.hubPipelineStep.deleteMany({ where: { pipeline_id: id } }),
      ...body.steps.map((s) =>
        app.prisma.hubPipelineStep.create({
          data: {
            pipeline_id: id,
            step_order: s.step_order,
            step_type: s.step_type as any,
            name: s.name,
            description: s.description ?? null,
            is_enabled: s.is_enabled ?? true,
            config: s.config ?? {},
            on_error: s.on_error ?? 'STOP',
            timeout_ms: s.timeout_ms ?? 30000,
          },
        }),
      ),
    ]);

    const updated = await app.prisma.hubPipeline.findUnique({
      where: { id },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    await app.hubAudit.log(user, 'pipeline', id, 'REPLACE_STEPS', { stepCount: body.steps.length });

    return { data: updated };
  });
}
