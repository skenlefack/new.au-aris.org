import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  SessionQuerySchema,
  SessionStatsQuerySchema,
  UuidParamSchema,
  type SessionQueryInput,
  type SessionStatsQueryInput,
  type UuidParamInput,
} from '../schemas/session.schemas.js';

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminRoles = rolesHook(
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
  );

  // GET /api/v1/credential/sessions — list sessions
  app.get<{ Querystring: SessionQueryInput }>('/api/v1/credential/sessions', {
    schema: { querystring: SessionQuerySchema },
    preHandler: [...authAndTenant, adminRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.sessionService.query(user, request.query);
  });

  // GET /api/v1/credential/sessions/stats — dashboard KPIs
  app.get<{ Querystring: SessionStatsQueryInput }>('/api/v1/credential/sessions/stats', {
    schema: { querystring: SessionStatsQuerySchema },
    preHandler: [...authAndTenant, adminRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.sessionService.getStats(user, request.query.days);
  });

  // POST /api/v1/credential/sessions/:id/revoke — force-terminate a session
  app.post<{ Params: UuidParamInput }>('/api/v1/credential/sessions/:id/revoke', {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, adminRoles],
  }, async (request, reply) => {
    const ok = await app.sessionService.revokeById(request.params.id);
    if (!ok) return reply.code(404).send({ statusCode: 404, message: 'Session not found or already inactive' });
    return { data: { id: request.params.id, revoked: true } };
  });
}
