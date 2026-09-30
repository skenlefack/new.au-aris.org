import type { FastifyInstance } from 'fastify';
import { tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UuidParamSchema, type UuidParamInput } from '../schemas/common.schema.js';

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // GET — main execution dashboard (reproduces the PDF)
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/dashboard',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.dashboardService.executionDashboard(request.params.id);
    },
  );

  // GET — regional breakdown
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/regional',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.dashboardService.regionalBreakdown(request.params.id);
    },
  );

  // GET — Gantt / timeline data
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/gantt',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.dashboardService.timelineGantt(request.params.id);
    },
  );

  // GET — burn rate chart data
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/burn-rate',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      return app.dashboardService.burnRate(request.params.id);
    },
  );

  // POST — create a snapshot (usually triggered weekly)
  app.post<{ Params: UuidParamInput }>(
    '/api/v1/programme-monitoring/programmes/:id/snapshot',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request, reply) => {
      return reply.code(201).send(await app.dashboardService.createSnapshot(request.params.id));
    },
  );
}
