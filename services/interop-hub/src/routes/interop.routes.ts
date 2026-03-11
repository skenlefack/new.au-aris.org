import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthHookOptions, AuthenticatedUser } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { PaginationQuery } from '@aris/shared-types';

export async function registerInteropRoutes(app: FastifyInstance): Promise<void> {
  // Auth hooks
  const authOpts: AuthHookOptions = {
    publicKey: (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n'),
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  const authAndTenant = [auth, tenant];

  // ---- WAHIS routes ----

  // POST /api/v1/interop/wahis/export — create WAHIS export (legacy)
  app.post('/api/v1/interop/wahis/export', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.WAHIS_FOCAL_POINT),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      countryCode: string;
      periodStart: string;
      periodEnd: string;
      format?: 'WOAH_JSON' | 'WOAH_XML';
    };

    if (!dto.countryCode || !dto.periodStart || !dto.periodEnd) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'countryCode, periodStart, and periodEnd are required',
      });
    }

    const result = await app.wahisService.createExport(dto, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/interop/export/wahis — full WAHIS XML export
  app.post('/api/v1/interop/export/wahis', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.WAHIS_FOCAL_POINT),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      countryIso: string;
      year: number;
      quarter: 1 | 2 | 3 | 4;
      diseases: string[];
    };

    if (!dto.countryIso || !dto.year || !dto.quarter) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'countryIso, year, and quarter are required',
      });
    }

    const result = await app.wahisService.exportWahis(dto, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/interop/wahis/exports — list WAHIS exports
  app.get('/api/v1/interop/wahis/exports', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    const query: PaginationQuery = {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
    };
    return app.wahisService.findAll(user, query);
  });

  // GET /api/v1/interop/wahis/exports/:id — get single export
  app.get('/api/v1/interop/wahis/exports/:id', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    return app.wahisService.findOne(id, user);
  });

  // ---- EMPRES routes ----

  // POST /api/v1/interop/empres/feed — create EMPRES feed
  app.post('/api/v1/interop/empres/feed', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      healthEventId: string;
      diseaseCode: string;
      countryCode: string;
      confidenceLevel: string;
      context: string;
      coordinates?: { lat: number; lng: number };
      species?: string[];
      cases?: number;
      deaths?: number;
    };

    if (!dto.healthEventId || !dto.diseaseCode || !dto.countryCode || !dto.confidenceLevel || !dto.context) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'healthEventId, diseaseCode, countryCode, confidenceLevel, and context are required',
      });
    }

    const result = await app.empresService.createFeed(dto, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/interop/export/empres — export EMPRES JSON file
  app.post('/api/v1/interop/export/empres', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      countryIso: string;
      dateFrom?: string;
      dateTo?: string;
      diseaseFilter?: string[];
    };

    if (!dto.countryIso) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'countryIso is required',
      });
    }

    const result = await app.empresService.exportEmpres(dto, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/interop/empres/feeds — list EMPRES feeds
  app.get('/api/v1/interop/empres/feeds', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    const query: PaginationQuery = {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
    };
    return app.empresService.findAll(user, query);
  });

  // ---- FAOSTAT routes ----

  // POST /api/v1/interop/faostat/sync — create FAOSTAT sync
  app.post('/api/v1/interop/faostat/sync', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      countryCode: string;
      year: number;
      records: Array<{
        countryCode: string;
        speciesCode: string;
        year: number;
        population: number;
        source?: string;
      }>;
      sourceUrl?: string;
    };

    if (!dto.countryCode || !dto.year || !Array.isArray(dto.records)) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'countryCode, year, and records array are required',
      });
    }

    const result = await app.faostatService.createSync(dto, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/interop/export/faostat — export FAOSTAT CSV
  app.post('/api/v1/interop/export/faostat', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as {
      indicatorCode: string;
      countryIso: string[];
      yearRange: [number, number];
    };

    if (!dto.indicatorCode || !Array.isArray(dto.countryIso) || !Array.isArray(dto.yearRange)) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'indicatorCode, countryIso array, and yearRange [start, end] are required',
      });
    }

    const result = await app.faostatService.exportFaostat(dto, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/interop/faostat/syncs — list FAOSTAT syncs
  app.get('/api/v1/interop/faostat/syncs', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    const query: PaginationQuery = {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
    };
    return app.faostatService.findAll(user, query);
  });

  // ---- Unified Export History routes ----

  // GET /api/v1/interop/exports/history — paginated export history across all connector types
  app.get('/api/v1/interop/exports/history', {
    preHandler: authAndTenant,
  }, async (request: FastifyRequest) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string | undefined>;
    const query = {
      page: qs.page ? parseInt(qs.page, 10) : undefined,
      limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
      sort: qs.sort,
      order: qs.order as 'asc' | 'desc' | undefined,
      connector: qs.connector,
      status: qs.status,
    };
    return app.wahisService.findAllExports(user, query);
  });

  // POST /api/v1/interop/exports/:id/retry — retry a failed export
  app.post('/api/v1/interop/exports/:id/retry', {
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.wahisService.retryExport(id, user);
    return reply.code(201).send(result);
  });

  // ---- Connector management routes ----

  // GET /api/v1/interop/connectors — list connectors
  app.get('/api/v1/interop/connectors', {
    preHandler: authAndTenant,
  }, async () => {
    return app.connectorService.listConnectors();
  });

  // GET /api/v1/interop/health — connector health check
  app.get('/api/v1/interop/health', {
    preHandler: authAndTenant,
  }, async () => {
    return app.connectorService.healthCheck();
  });
}
