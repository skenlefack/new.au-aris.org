import { readFileSync } from 'fs';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthHookOptions, AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery } from '@aris/shared-types';

export async function registerCountryIngestionRoutes(app: FastifyInstance): Promise<void> {
  let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
  if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
    try { publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8'); } catch { /* ignore */ }
  }
  const authOpts: AuthHookOptions = { publicKey };
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

  // Legacy ingestion endpoints are retired: they validated records but never loaded
  // them into ARIS. Partners must use the Interop-Hub ingest API, which runs the full
  // pipeline (mapping, quality gates, review, loading into collecte).
  const retired = (replacement: string) =>
    async (_request: FastifyRequest, reply: FastifyReply) => reply
      .code(410)
      .header('Link', `<${replacement}>; rel="successor-version"`)
      .send({
        statusCode: 410,
        message: `This endpoint has been retired. Use ${replacement} (see the ARIS Interop-Hub specification).`,
        errors: [{ field: 'endpoint', message: `Replaced by ${replacement}` }],
      });

  app.post('/api/v1/interop/country-ingestion/push', retired('/api/v1/hub/ingest/push'));
  app.post('/api/v1/interop/country-ingestion/upload', retired('/api/v1/hub/ingest/upload'));
  app.post('/api/v1/interop/country-ingestion/pull', retired('/api/v1/hub/pipelines/{id}/execute'));

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
