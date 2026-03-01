import type { FastifyInstance } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateMappingSchema,
  UpdateMappingSchema,
  ConnectionIdParamSchema,
  MappingIdParamSchema,
  MappingListQuerySchema,
  type CreateMappingBody,
  type UpdateMappingBody,
  type ConnectionIdParam,
  type MappingIdParam,
  type MappingListQuery,
} from '../schemas/mapping.schemas.js';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
];

export async function registerMappingRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // POST /api/v1/interop-v2/connections/:id/mappings
  app.post<{ Params: ConnectionIdParam; Body: CreateMappingBody }>('/api/v1/interop-v2/connections/:id/mappings', {
    schema: { params: ConnectionIdParamSchema, body: CreateMappingSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.mappingService.create(request.params.id, request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/interop-v2/connections/:id/mappings
  app.get<{ Params: ConnectionIdParam; Querystring: MappingListQuery }>('/api/v1/interop-v2/connections/:id/mappings', {
    schema: { params: ConnectionIdParamSchema, querystring: MappingListQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mappingService.findByConnection(request.params.id, user, request.query);
  });

  // PATCH /api/v1/interop-v2/connections/:id/mappings/:mid
  app.patch<{ Params: MappingIdParam; Body: UpdateMappingBody }>('/api/v1/interop-v2/connections/:id/mappings/:mid', {
    schema: { params: MappingIdParamSchema, body: UpdateMappingSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mappingService.update(request.params.mid, request.body, user);
  });

  // DELETE /api/v1/interop-v2/connections/:id/mappings/:mid
  app.delete<{ Params: MappingIdParam }>('/api/v1/interop-v2/connections/:id/mappings/:mid', {
    schema: { params: MappingIdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.mappingService.remove(request.params.mid, user);
  });
}
