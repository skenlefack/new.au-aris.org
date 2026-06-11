import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthHookOptions, AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery } from '@aris/shared-types';

export async function registerCountryIngestionRoutes(app: FastifyInstance): Promise<void> {
  const authOpts: AuthHookOptions = {
    publicKey: (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n'),
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();
  const authAndTenant = [auth, tenant];

  const adminRoles = rolesHook(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  );

  const ingestionRoles = rolesHook(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
    UserRole.WAHIS_FOCAL_POINT,
  );

  // ────────────────────────────────────────────────
  // Country Connections CRUD
  // ────────────────────────────────────────────────

  // POST /api/v1/interop/country-connections — create a new country connection
  app.post('/api/v1/interop/country-connections', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as any;

    if (!dto.countryCode || !dto.countryName || !dto.integrationModel || !dto.systemName || !dto.domains) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'countryCode, countryName, integrationModel, systemName, and domains are required',
      });
    }

    const result = await app.countryIngestionService.createConnection(dto, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/interop/country-connections — list all connections
  app.get('/api/v1/interop/country-connections', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    return app.countryIngestionService.findAllConnections(user, {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
      countryCode: qs.countryCode ?? qs.country,
      model: qs.model,
      status: qs.status,
    });
  });

  // GET /api/v1/interop/country-connections/:id — get single connection
  app.get('/api/v1/interop/country-connections/:id', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return app.countryIngestionService.findOneConnection(id, user);
  });

  // PATCH /api/v1/interop/country-connections/:id — update connection
  app.patch('/api/v1/interop/country-connections/:id', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const dto = request.body as Record<string, unknown>;
    return app.countryIngestionService.updateConnection(id, dto, user);
  });

  // POST /api/v1/interop/country-connections/:id/activate — activate a connection
  app.post('/api/v1/interop/country-connections/:id/activate', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return app.countryIngestionService.updateConnection(id, { status: 'ACTIVE' }, user);
  });

  // POST /api/v1/interop/country-connections/:id/suspend — suspend a connection
  app.post('/api/v1/interop/country-connections/:id/suspend', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return app.countryIngestionService.updateConnection(id, { status: 'SUSPENDED' }, user);
  });

  // ────────────────────────────────────────────────
  // Referential Mappings
  // ────────────────────────────────────────────────

  // POST /api/v1/interop/country-connections/:id/mappings — bulk upsert mappings
  app.post('/api/v1/interop/country-connections/:id/mappings', {
    preHandler: [...authAndTenant, ingestionRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const dto = request.body as { referentialType: string; mappings: any[] };

    if (!dto.referentialType || !Array.isArray(dto.mappings)) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'referentialType and mappings array are required',
      });
    }

    const result = await app.countryIngestionService.upsertMappings(
      id,
      dto.referentialType,
      dto.mappings,
      user,
    );
    return reply.code(200).send(result);
  });

  // GET /api/v1/interop/country-connections/:id/mappings — list mappings
  app.get('/api/v1/interop/country-connections/:id/mappings', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const qs = request.query as Record<string, string | undefined>;
    return app.countryIngestionService.findMappings(id, user, {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
      referentialType: qs.referentialType ?? qs.type,
    });
  });

  // ────────────────────────────────────────────────
  // Data Ingestion Endpoints
  // ────────────────────────────────────────────────

  // POST /api/v1/interop/country-ingestion/push — API Push ingestion
  app.post('/api/v1/interop/country-ingestion/push', {
    preHandler: [...authAndTenant, ingestionRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      domain: string;
      entityType: string;
      sourceSystem?: string;
      sourceVersion?: string;
      records: Record<string, unknown>[];
      mappingProfile?: string;
    };

    if (!dto.domain || !dto.entityType || !Array.isArray(dto.records) || dto.records.length === 0) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'domain, entityType, and non-empty records array are required',
      });
    }

    if (dto.records.length > 10000) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'Maximum 10,000 records per push. Use file upload for larger batches.',
      });
    }

    const result = await app.countryIngestionService.ingestPush(dto, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/interop/country-ingestion/upload — File upload ingestion
  app.post('/api/v1/interop/country-ingestion/upload', {
    preHandler: [...authAndTenant, ingestionRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;

    // Fastify multipart — file comes from request body for multipart
    const data = await (request as any).file();
    if (!data) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'File upload is required (multipart/form-data with file field)',
      });
    }

    const fileBuffer = await data.toBuffer();
    const fileName = data.filename;

    // Get fields from multipart
    const fields = data.fields as Record<string, { value: string }>;
    const domain = fields.domain?.value;
    const entityType = fields.entityType?.value;
    const countryCode = fields.countryCode?.value;
    const period = fields.period?.value;
    const mappingProfile = fields.mappingProfile?.value;

    if (!domain || !entityType || !countryCode) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'domain, entityType, and countryCode fields are required',
      });
    }

    const result = await app.countryIngestionService.ingestFileUpload(
      { domain, entityType, countryCode, period, mappingProfile },
      fileBuffer,
      fileName,
      user,
    );
    return reply.code(201).send(result);
  });

  // POST /api/v1/interop/country-ingestion/pull — Trigger manual API Pull
  app.post('/api/v1/interop/country-ingestion/pull', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      connectionId: string;
      domain?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    if (!dto.connectionId) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'connectionId is required',
      });
    }

    const result = await app.countryIngestionService.triggerPull(dto.connectionId, dto, user);
    return reply.code(201).send(result);
  });

  // ────────────────────────────────────────────────
  // Transaction History
  // ────────────────────────────────────────────────

  // GET /api/v1/interop/country-ingestion/transactions — list all transactions
  app.get('/api/v1/interop/country-ingestion/transactions', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    return app.countryIngestionService.findAllTransactions(user, {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
      connectionId: qs.connectionId,
      domain: qs.domain,
      status: qs.status,
      model: qs.model,
    });
  });

  // GET /api/v1/interop/country-ingestion/transactions/:id — get single transaction
  app.get('/api/v1/interop/country-ingestion/transactions/:id', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return app.countryIngestionService.findOneTransaction(id, user);
  });

  // POST /api/v1/interop/country-ingestion/transactions/:id/retry — retry failed transaction
  app.post('/api/v1/interop/country-ingestion/transactions/:id/retry', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.countryIngestionService.retryTransaction(id, user);
    return reply.code(200).send(result);
  });

  // ────────────────────────────────────────────────
  // Dashboard / Stats
  // ────────────────────────────────────────────────

  // GET /api/v1/interop/country-ingestion/stats — ingestion dashboard
  app.get('/api/v1/interop/country-ingestion/stats', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    return app.countryIngestionService.getIngestionStats(user, {
      countryCode: qs.countryCode,
      days: qs.days ? parseInt(qs.days, 10) : undefined,
    });
  });
}
