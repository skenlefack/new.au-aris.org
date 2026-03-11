import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateColonyHealthSchema,
  UpdateColonyHealthSchema,
  ColonyHealthFilterSchema,
  UuidParamSchema,
  type CreateColonyHealthInput,
  type UpdateColonyHealthInput,
  type ColonyHealthFilterInput,
  type UuidParamInput,
} from '../schemas/colony-health.schema';

export async function registerColonyHealthRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/apiculture/health — create colony health inspection
  app.post<{ Body: CreateColonyHealthInput }>('/api/v1/apiculture/health', {
    schema: { body: CreateColonyHealthSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.FIELD_AGENT,
      ),
    ],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.colonyHealthService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/apiculture/health — list colony health inspections
  app.get<{ Querystring: ColonyHealthFilterInput }>('/api/v1/apiculture/health', {
    schema: { querystring: ColonyHealthFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.colonyHealthService.findAll(user, request.query);
  });

  // GET /api/v1/apiculture/health/:id — get colony health inspection by id
  app.get<{ Params: UuidParamInput }>('/api/v1/apiculture/health/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.colonyHealthService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/apiculture/health/:id — update colony health inspection
  app.patch<{ Params: UuidParamInput; Body: UpdateColonyHealthInput }>('/api/v1/apiculture/health/:id', {
    schema: { params: UuidParamSchema, body: UpdateColonyHealthSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.colonyHealthService.update(request.params.id, request.body, user);
  });
}
