import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  KpiQuerySchema,
  DomainParamSchema,
  AggregateSchema,
  DashboardSchema,
  WorkerStateSchema,
} from '../schemas/analytics.schema';
import type {
  KpiQuery,
  AggregateRequest,
  DashboardQuery,
  WorkerStateQuery,
} from '../schemas/analytics.schema';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics-worker';

  // GET /api/v1/analytics-worker/metrics — Query metrics with pagination
  app.get(`${PREFIX}/metrics`, {
    preHandler: [app.authHookFn],
    schema: KpiQuerySchema,
  }, async (request: FastifyRequest<{ Querystring: KpiQuery }>, reply: FastifyReply) => {
    const result = await app.analyticsService.getMetrics(request.query);
    return reply.code(200).send(result);
  });

  // GET /api/v1/analytics-worker/metrics/:domain — Get domain metrics
  app.get(`${PREFIX}/metrics/:domain`, {
    preHandler: [app.authHookFn],
    schema: DomainParamSchema,
  }, async (request: FastifyRequest<{ Params: { domain: string } }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.analyticsService.getDomainMetrics(request.params.domain, user.tenantId);
    return reply.code(200).send(result);
  });

  // GET /api/v1/analytics-worker/dashboard — Dashboard summary
  app.get(`${PREFIX}/dashboard`, {
    preHandler: [app.authHookFn],
    schema: DashboardSchema,
  }, async (request: FastifyRequest<{ Querystring: DashboardQuery }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.analyticsService.getDashboard(user.tenantId, request.query);
    return reply.code(200).send(result);
  });

  // POST /api/v1/analytics-worker/aggregate — Trigger aggregation (admin)
  app.post(`${PREFIX}/aggregate`, {
    preHandler: [app.authHookFn, rolesHook(...ADMIN_ROLES)],
    schema: AggregateSchema,
  }, async (request: FastifyRequest<{ Body: AggregateRequest }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.analyticsService.triggerAggregation(request.body, user.tenantId, user.userId);
    return reply.code(200).send(result);
  });

  // GET /api/v1/analytics-worker/workers — Worker states (admin)
  app.get(`${PREFIX}/workers`, {
    preHandler: [app.authHookFn, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
    schema: WorkerStateSchema,
  }, async (request: FastifyRequest<{ Querystring: WorkerStateQuery }>, reply: FastifyReply) => {
    const result = await app.analyticsService.getWorkerStates(request.query);
    return reply.code(200).send(result);
  });
}
