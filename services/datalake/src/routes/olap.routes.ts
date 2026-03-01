import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { AnalyticalQueryParams, TimeSeriesParams, GeoQueryParams } from '../services/query-engine.service';
import type { CreateExportDto } from '../services/export.service';
import {
  analyticalQuerySchema,
  timeSeriesQuerySchema,
  geoQuerySchema,
  createExportSchema,
  exportIdParamSchema,
  listExportsSchema,
  partitionIdParamSchema,
  listPartitionsSchema,
  schemaQuerySchema,
  reindexOlapSchema,
} from '../schemas/olap.schema';

export async function registerOlapRoutes(app: FastifyInstance): Promise<void> {
  // ── Analytical Query ──

  // GET /api/v1/datalake/query — auth required
  app.get('/api/v1/datalake/query', {
    schema: analyticalQuerySchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string>;

    const params: AnalyticalQueryParams = {
      source: qs['source'],
      entityType: qs['entityType'],
      dimensions: qs['dimensions'] ? qs['dimensions'].split(',').map((s: string) => s.trim()) : [],
      measures: qs['measures'] ? JSON.parse(qs['measures']) : [{ field: '*', function: 'COUNT' }],
      filters: qs['filters'] ? JSON.parse(qs['filters']) : undefined,
      dateRange: qs['dateFrom'] || qs['dateTo']
        ? { from: qs['dateFrom'] ?? '', to: qs['dateTo'] ?? '' }
        : undefined,
      page: qs['page'] ? parseInt(qs['page'], 10) : 1,
      limit: qs['limit'] ? parseInt(qs['limit'], 10) : 100,
    };

    const result = await app.queryEngine.query(params, user.tenantId, user.tenantLevel ?? 'MEMBER_STATE');
    return reply.code(200).send(result);
  });

  // GET /api/v1/datalake/query/timeseries — auth required
  app.get('/api/v1/datalake/query/timeseries', {
    schema: timeSeriesQuerySchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string>;

    const params: TimeSeriesParams = {
      metric: qs['metric']!,
      function: qs['function']!,
      granularity: qs['granularity']!,
      dateRange: { from: qs['dateFrom']!, to: qs['dateTo']! },
      source: qs['source'],
      entityType: qs['entityType'],
      groupBy: qs['groupBy'],
    };

    const result = await app.queryEngine.timeseries(params, user.tenantId, user.tenantLevel ?? 'MEMBER_STATE');
    return reply.code(200).send(result);
  });

  // GET /api/v1/datalake/query/geo — auth required
  app.get('/api/v1/datalake/query/geo', {
    schema: geoQuerySchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as Record<string, string>;

    const params: GeoQueryParams = {
      bbox: {
        minLat: parseFloat(qs['minLat']!),
        minLng: parseFloat(qs['minLng']!),
        maxLat: parseFloat(qs['maxLat']!),
        maxLng: parseFloat(qs['maxLng']!),
      },
      entityType: qs['entityType'],
      source: qs['source'],
      dateRange: qs['dateFrom'] || qs['dateTo']
        ? { from: qs['dateFrom'] ?? '', to: qs['dateTo'] ?? '' }
        : undefined,
      limit: qs['limit'] ? parseInt(qs['limit'], 10) : 1000,
    };

    const result = await app.queryEngine.geo(params, user.tenantId, user.tenantLevel ?? 'MEMBER_STATE');
    return reply.code(200).send(result);
  });

  // ── Exports ──

  // POST /api/v1/datalake/exports — auth + roles
  app.post('/api/v1/datalake/exports', {
    schema: createExportSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.ANALYST,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const dto = request.body as CreateExportDto;
    const result = await app.exportService.createExport(dto, user.tenantId, user.userId, user.tenantLevel ?? 'MEMBER_STATE');
    return reply.code(202).send(result);
  });

  // GET /api/v1/datalake/exports — auth required
  app.get('/api/v1/datalake/exports', {
    schema: listExportsSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as { page?: number; limit?: number; status?: string };
    const result = await app.exportService.listExports(user.tenantId, user.tenantLevel ?? 'MEMBER_STATE', qs);
    return reply.code(200).send(result);
  });

  // GET /api/v1/datalake/exports/:id — auth required
  app.get('/api/v1/datalake/exports/:id', {
    schema: exportIdParamSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.exportService.getExport(id, user.tenantId, user.tenantLevel ?? 'MEMBER_STATE');
    return reply.code(200).send(result);
  });

  // ── Partitions ──

  // GET /api/v1/datalake/partitions — auth + admin
  app.get('/api/v1/datalake/partitions', {
    schema: listPartitionsSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const qs = request.query as { page?: number; limit?: number; status?: string };
    const result = await app.partitionService.listPartitions(user.tenantId, user.tenantLevel ?? 'MEMBER_STATE', qs);
    return reply.code(200).send(result);
  });

  // POST /api/v1/datalake/partitions/:id/archive — auth + admin
  app.post('/api/v1/datalake/partitions/:id/archive', {
    schema: partitionIdParamSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params as { id: string };
    const result = await app.partitionService.archivePartition(id, user.userId);
    return reply.code(200).send(result);
  });

  // ── Schema ──

  // GET /api/v1/datalake/schema — auth required
  app.get('/api/v1/datalake/schema', {
    schema: schemaQuerySchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.queryEngine.getSchema(user.tenantId, user.tenantLevel ?? 'MEMBER_STATE');
    return reply.code(200).send(result);
  });

  // ── Reindex ──

  // POST /api/v1/datalake/reindex — auth + admin (delegates to existing datalakeService)
  app.post('/api/v1/datalake/reindex', {
    schema: reindexOlapSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { indexName } = request.body as { indexName: string };
    const result = await app.datalakeService.reindex(indexName, user.tenantId, user.userId);
    return reply.code(202).send(result);
  });
}
