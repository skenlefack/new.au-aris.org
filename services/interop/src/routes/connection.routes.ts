import type { FastifyInstance } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateConnectionSchema,
  UpdateConnectionSchema,
  IdParamSchema,
  ConnectionListQuerySchema,
  type CreateConnectionBody,
  type UpdateConnectionBody,
  type IdParam,
  type ConnectionListQuery,
} from '../schemas/connection.schemas.js';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

export async function registerConnectionRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // POST /api/v1/interop-v2/connections
  app.post<{ Body: CreateConnectionBody }>('/api/v1/interop-v2/connections', {
    schema: { body: CreateConnectionSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.connectionService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/interop-v2/connections
  app.get<{ Querystring: ConnectionListQuery }>('/api/v1/interop-v2/connections', {
    schema: { querystring: ConnectionListQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.connectionService.findAll(user, request.query);
  });

  // GET /api/v1/interop-v2/connections/:id
  app.get<{ Params: IdParam }>('/api/v1/interop-v2/connections/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.connectionService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/interop-v2/connections/:id
  app.patch<{ Params: IdParam; Body: UpdateConnectionBody }>('/api/v1/interop-v2/connections/:id', {
    schema: { params: IdParamSchema, body: UpdateConnectionSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.connectionService.update(request.params.id, request.body, user);
  });

  // DELETE /api/v1/interop-v2/connections/:id
  app.delete<{ Params: IdParam }>('/api/v1/interop-v2/connections/:id', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.connectionService.remove(request.params.id, user);
  });

  // POST /api/v1/interop-v2/connections/:id/test
  app.post<{ Params: IdParam }>('/api/v1/interop-v2/connections/:id/test', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.connectionService.testConnection(request.params.id, user);
  });

  // POST /api/v1/interop-v2/connections/:id/sync
  app.post<{ Params: IdParam }>('/api/v1/interop-v2/connections/:id/sync', {
    schema: { params: IdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.connectionService.triggerSync(request.params.id, user);
  });
}
