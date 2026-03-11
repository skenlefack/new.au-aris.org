import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateApiarySchema,
  UpdateApiarySchema,
  ApiaryFilterSchema,
  UuidParamSchema,
  type CreateApiaryInput,
  type UpdateApiaryInput,
  type ApiaryFilterInput,
  type UuidParamInput,
} from '../schemas/apiary.schema';

export async function registerApiaryRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/apiculture/apiaries — create apiary
  app.post<{ Body: CreateApiaryInput }>('/api/v1/apiculture/apiaries', {
    schema: { body: CreateApiarySchema },
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
    const result = await app.apiaryService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/apiculture/apiaries — list apiaries
  app.get<{ Querystring: ApiaryFilterInput }>('/api/v1/apiculture/apiaries', {
    schema: { querystring: ApiaryFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.apiaryService.findAll(user, request.query);
  });

  // GET /api/v1/apiculture/apiaries/:id — get apiary by id
  app.get<{ Params: UuidParamInput }>('/api/v1/apiculture/apiaries/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.apiaryService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/apiculture/apiaries/:id — update apiary
  app.patch<{ Params: UuidParamInput; Body: UpdateApiaryInput }>('/api/v1/apiculture/apiaries/:id', {
    schema: { params: UuidParamSchema, body: UpdateApiarySchema },
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
    return app.apiaryService.update(request.params.id, request.body, user);
  });
}
