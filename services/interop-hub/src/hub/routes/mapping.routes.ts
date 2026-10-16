import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authAndTenant, hubManagerRoles, hubReadRoles } from '../auth';
import { parsePagination, paginatedResponse, qs, getUser, badRequest, notFound } from '../helpers';

export async function registerMappingRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/hub/connections/:connectionId';

  /** Verify connection belongs to tenant */
  async function verifyConnection(connectionId: string, tenantId: string) {
    const connection = await app.prisma.hubConnection.findFirst({
      where: { id: connectionId, tenant_id: tenantId },
    });
    if (!connection) throw notFound('Connection');
    return connection;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REFERENTIAL MAPPINGS
  // ═══════════════════════════════════════════════════════════════

  // ── POST /referential-mappings — Create mapping ──
  app.post(`${prefix}/referential-mappings`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    const body = request.body as {
      referential_type: string;
      direction?: string;
      source_code: string;
      source_label?: string;
      target_code: string;
      target_label?: string;
      target_id?: string;
      is_verified?: boolean;
      notes?: string;
    };

    if (!body.referential_type || !body.source_code || !body.target_code) {
      throw badRequest('referential_type, source_code, and target_code are required');
    }

    const mapping = await app.prisma.hubReferentialMapping.create({
      data: {
        connection_id: connectionId,
        referential_type: body.referential_type as any,
        direction: (body.direction as any) ?? 'INBOUND',
        source_code: body.source_code,
        source_label: body.source_label ?? null,
        target_code: body.target_code,
        target_label: body.target_label ?? null,
        target_id: body.target_id ?? null,
        is_verified: body.is_verified ?? false,
        notes: body.notes ?? null,
      },
    });

    await app.hubAudit.log(user, 'referential_mapping', mapping.id, 'CREATE', {
      connectionId,
      type: body.referential_type,
    });

    return reply.code(201).send({ data: mapping });
  });

  // ── GET /referential-mappings — List mappings ──
  app.get(`${prefix}/referential-mappings`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    const { page, limit, skip } = parsePagination(request);
    const referentialType = qs(request, 'referential_type');

    const where: Record<string, unknown> = { connection_id: connectionId };
    if (referentialType) where.referential_type = referentialType;

    const [data, total] = await Promise.all([
      app.prisma.hubReferentialMapping.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      app.prisma.hubReferentialMapping.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── PATCH /referential-mappings/:id — Update mapping ──
  app.patch(`${prefix}/referential-mappings/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { connectionId, id } = request.params as { connectionId: string; id: string };
    await verifyConnection(connectionId, user.tenantId);

    const existing = await app.prisma.hubReferentialMapping.findFirst({
      where: { id, connection_id: connectionId },
    });
    if (!existing) throw notFound('Referential mapping');

    const body = request.body as Record<string, unknown>;
    const { id: _, connection_id: __, created_at: ___, ...updates } = body;

    const updated = await app.prisma.hubReferentialMapping.update({
      where: { id },
      data: updates as any,
    });

    await app.hubAudit.log(user, 'referential_mapping', id, 'UPDATE', { fields: Object.keys(updates) });

    return { data: updated };
  });

  // ── DELETE /referential-mappings/:id — Delete mapping ──
  app.delete(`${prefix}/referential-mappings/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId, id } = request.params as { connectionId: string; id: string };
    await verifyConnection(connectionId, user.tenantId);

    const existing = await app.prisma.hubReferentialMapping.findFirst({
      where: { id, connection_id: connectionId },
    });
    if (!existing) throw notFound('Referential mapping');

    await app.prisma.hubReferentialMapping.delete({ where: { id } });
    await app.hubAudit.log(user, 'referential_mapping', id, 'DELETE', {
      type: existing.referential_type,
      sourceCode: existing.source_code,
    });

    return reply.code(204).send();
  });

  // ── POST /referential-mappings/bulk — Bulk create ──
  app.post(`${prefix}/referential-mappings/bulk`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    const body = request.body as {
      referential_type: string;
      direction?: string;
      mappings: Array<{
        source_code: string;
        source_label?: string;
        target_code: string;
        target_label?: string;
        target_id?: string;
        is_verified?: boolean;
        notes?: string;
      }>;
    };

    if (!body.referential_type || !Array.isArray(body.mappings) || body.mappings.length === 0) {
      throw badRequest('referential_type and non-empty mappings[] are required');
    }

    if (body.mappings.length > 5000) {
      throw badRequest('Maximum 5,000 mappings per bulk request');
    }

    const direction = (body.direction as any) ?? 'INBOUND';

    // Upsert: if source_code + referential_type + direction already exists, update; otherwise create
    const results = await app.prisma.$transaction(
      body.mappings.map((m) =>
        app.prisma.hubReferentialMapping.upsert({
          where: {
            connection_id_referential_type_direction_source_code: {
              connection_id: connectionId,
              referential_type: body.referential_type as any,
              direction,
              source_code: m.source_code,
            },
          },
          update: {
            source_label: m.source_label ?? undefined,
            target_code: m.target_code,
            target_label: m.target_label ?? undefined,
            target_id: m.target_id ?? undefined,
            is_verified: m.is_verified ?? undefined,
            notes: m.notes ?? undefined,
          },
          create: {
            connection_id: connectionId,
            referential_type: body.referential_type as any,
            direction,
            source_code: m.source_code,
            source_label: m.source_label ?? null,
            target_code: m.target_code,
            target_label: m.target_label ?? null,
            target_id: m.target_id ?? null,
            is_verified: m.is_verified ?? false,
            notes: m.notes ?? null,
          },
        }),
      ),
    );

    await app.hubAudit.log(user, 'referential_mapping', connectionId, 'BULK_CREATE', {
      type: body.referential_type,
      count: body.mappings.length,
    });

    return reply.code(201).send({
      data: results,
      meta: { total: results.length },
    });
  });

  // ── POST /referential-mappings/import — Import from CSV/JSON ──
  app.post(`${prefix}/referential-mappings/import`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    // Expect multipart file upload OR JSON body
    const contentType = request.headers['content-type'] ?? '';

    let mappings: Array<{
      source_code: string;
      source_label?: string;
      target_code: string;
      target_label?: string;
      target_id?: string;
    }> = [];
    let referentialType: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      // Multipart upload
      const data = await (request as any).file();
      if (!data) throw badRequest('File upload required');

      const fileBuffer = await data.toBuffer();
      const fileName = (data.filename as string).toLowerCase();
      const fields = data.fields as Record<string, { value: string }>;
      referentialType = fields.referential_type?.value;

      if (!referentialType) throw badRequest('referential_type field is required');

      if (fileName.endsWith('.json')) {
        const parsed = JSON.parse(fileBuffer.toString('utf-8'));
        mappings = Array.isArray(parsed) ? parsed : parsed.mappings ?? [];
      } else if (fileName.endsWith('.csv')) {
        // Simple CSV parser: header row + data rows
        const lines = fileBuffer.toString('utf-8').split('\n').filter((l: string) => l.trim());
        if (lines.length < 2) throw badRequest('CSV must have header + at least one data row');
        const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c: string) => c.trim());
          const row: Record<string, string> = {};
          headers.forEach((h: string, idx: number) => { row[h] = cols[idx] ?? ''; });
          mappings.push({
            source_code: row['source_code'] ?? row['source'] ?? '',
            source_label: row['source_label'] ?? row['source_name'] ?? undefined,
            target_code: row['target_code'] ?? row['target'] ?? '',
            target_label: row['target_label'] ?? row['target_name'] ?? undefined,
            target_id: row['target_id'] ?? undefined,
          });
        }
      } else {
        throw badRequest('Supported file formats: .json, .csv');
      }
    } else {
      // JSON body
      const body = request.body as {
        referential_type: string;
        mappings: typeof mappings;
      };
      referentialType = body.referential_type;
      mappings = body.mappings ?? [];
    }

    if (!referentialType || mappings.length === 0) {
      throw badRequest('referential_type and at least one mapping are required');
    }

    // Filter out invalid rows
    const validMappings = mappings.filter((m) => m.source_code && m.target_code);

    const results = await app.prisma.$transaction(
      validMappings.map((m) =>
        app.prisma.hubReferentialMapping.upsert({
          where: {
            connection_id_referential_type_direction_source_code: {
              connection_id: connectionId,
              referential_type: referentialType as any,
              direction: 'INBOUND',
              source_code: m.source_code,
            },
          },
          update: {
            source_label: m.source_label ?? undefined,
            target_code: m.target_code,
            target_label: m.target_label ?? undefined,
            target_id: m.target_id ?? undefined,
          },
          create: {
            connection_id: connectionId,
            referential_type: referentialType as any,
            direction: 'INBOUND',
            source_code: m.source_code,
            source_label: m.source_label ?? null,
            target_code: m.target_code,
            target_label: m.target_label ?? null,
            target_id: m.target_id ?? null,
            is_verified: false,
          },
        }),
      ),
    );

    await app.hubAudit.log(user, 'referential_mapping', connectionId, 'IMPORT', {
      type: referentialType,
      imported: results.length,
      skipped: mappings.length - validMappings.length,
    });

    return reply.code(201).send({
      data: {
        imported: results.length,
        skipped: mappings.length - validMappings.length,
        total: mappings.length,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  FIELD MAPPINGS
  // ═══════════════════════════════════════════════════════════════

  // ── POST /field-mappings — Create field mapping ──
  app.post(`${prefix}/field-mappings`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    const body = request.body as {
      entity_type: string;
      direction: string;
      source_field: string;
      target_field: string;
      transformation?: string;
      default_value?: string;
      is_required?: boolean;
      notes?: string;
    };

    if (!body.entity_type || !body.direction || !body.source_field || !body.target_field) {
      throw badRequest('entity_type, direction, source_field, and target_field are required');
    }

    const mapping = await app.prisma.hubFieldMapping.create({
      data: {
        connection_id: connectionId,
        entity_type: body.entity_type,
        direction: body.direction as any,
        source_field: body.source_field,
        target_field: body.target_field,
        transformation: body.transformation ?? null,
        default_value: body.default_value ?? null,
        is_required: body.is_required ?? false,
        notes: body.notes ?? null,
      },
    });

    await app.hubAudit.log(user, 'field_mapping', mapping.id, 'CREATE', {
      connectionId,
      entityType: body.entity_type,
    });

    return reply.code(201).send({ data: mapping });
  });

  // ── GET /field-mappings — List field mappings ──
  app.get(`${prefix}/field-mappings`, {
    preHandler: [...authAndTenant, hubReadRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    const { page, limit, skip } = parsePagination(request);
    const entityType = qs(request, 'entity_type');
    const direction = qs(request, 'direction');

    const where: Record<string, unknown> = { connection_id: connectionId };
    if (entityType) where.entity_type = entityType;
    if (direction) where.direction = direction;

    const [data, total] = await Promise.all([
      app.prisma.hubFieldMapping.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      app.prisma.hubFieldMapping.count({ where: where as any }),
    ]);

    return paginatedResponse(data, total, page, limit);
  });

  // ── PATCH /field-mappings/:id — Update field mapping ──
  app.patch(`${prefix}/field-mappings/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest) => {
    const user = getUser(request);
    const { connectionId, id } = request.params as { connectionId: string; id: string };
    await verifyConnection(connectionId, user.tenantId);

    const existing = await app.prisma.hubFieldMapping.findFirst({
      where: { id, connection_id: connectionId },
    });
    if (!existing) throw notFound('Field mapping');

    const body = request.body as Record<string, unknown>;
    const { id: _, connection_id: __, created_at: ___, ...updates } = body;

    const updated = await app.prisma.hubFieldMapping.update({
      where: { id },
      data: updates as any,
    });

    await app.hubAudit.log(user, 'field_mapping', id, 'UPDATE', { fields: Object.keys(updates) });

    return { data: updated };
  });

  // ── DELETE /field-mappings/:id — Delete field mapping ──
  app.delete(`${prefix}/field-mappings/:id`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId, id } = request.params as { connectionId: string; id: string };
    await verifyConnection(connectionId, user.tenantId);

    const existing = await app.prisma.hubFieldMapping.findFirst({
      where: { id, connection_id: connectionId },
    });
    if (!existing) throw notFound('Field mapping');

    await app.prisma.hubFieldMapping.delete({ where: { id } });
    await app.hubAudit.log(user, 'field_mapping', id, 'DELETE', {
      entityType: existing.entity_type,
      sourceField: existing.source_field,
    });

    return reply.code(204).send();
  });

  // ── POST /field-mappings/bulk — Bulk create field mappings ──
  app.post(`${prefix}/field-mappings/bulk`, {
    preHandler: [...authAndTenant, hubManagerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { connectionId } = request.params as { connectionId: string };
    await verifyConnection(connectionId, user.tenantId);

    const body = request.body as {
      entity_type: string;
      direction: string;
      mappings: Array<{
        source_field: string;
        target_field: string;
        transformation?: string;
        default_value?: string;
        is_required?: boolean;
        notes?: string;
      }>;
    };

    if (!body.entity_type || !body.direction || !Array.isArray(body.mappings) || body.mappings.length === 0) {
      throw badRequest('entity_type, direction, and non-empty mappings[] are required');
    }

    const results = await app.prisma.$transaction(
      body.mappings.map((m) =>
        app.prisma.hubFieldMapping.upsert({
          where: {
            connection_id_entity_type_direction_source_field_target_field: {
              connection_id: connectionId,
              entity_type: body.entity_type,
              direction: body.direction as any,
              source_field: m.source_field,
              target_field: m.target_field,
            },
          },
          update: {
            transformation: m.transformation ?? undefined,
            default_value: m.default_value ?? undefined,
            is_required: m.is_required ?? undefined,
            notes: m.notes ?? undefined,
          },
          create: {
            connection_id: connectionId,
            entity_type: body.entity_type,
            direction: body.direction as any,
            source_field: m.source_field,
            target_field: m.target_field,
            transformation: m.transformation ?? null,
            default_value: m.default_value ?? null,
            is_required: m.is_required ?? false,
            notes: m.notes ?? null,
          },
        }),
      ),
    );

    await app.hubAudit.log(user, 'field_mapping', connectionId, 'BULK_CREATE', {
      entityType: body.entity_type,
      count: results.length,
    });

    return reply.code(201).send({
      data: results,
      meta: { total: results.length },
    });
  });
}
