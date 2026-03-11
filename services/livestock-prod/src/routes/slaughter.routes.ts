import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateSlaughterSchema,
  UpdateSlaughterSchema,
  SlaughterFilterSchema,
  UuidParamSchema,
  type CreateSlaughterInput,
  type UpdateSlaughterInput,
  type SlaughterFilterInput,
  type UuidParamInput,
} from '../schemas/slaughter.schema.js';

export async function registerSlaughterRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/livestock/slaughter — create slaughter record
  app.post<{ Body: CreateSlaughterInput }>('/api/v1/livestock/slaughter', {
    schema: { body: CreateSlaughterSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.slaughterService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/livestock/slaughter — list slaughter records
  app.get<{ Querystring: SlaughterFilterInput }>('/api/v1/livestock/slaughter', {
    schema: { querystring: SlaughterFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.slaughterService.findAll(user, request.query);
  });

  // GET /api/v1/livestock/slaughter/:id — get slaughter record by id
  app.get<{ Params: UuidParamInput }>('/api/v1/livestock/slaughter/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.slaughterService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/livestock/slaughter/:id — update slaughter record
  app.patch<{ Params: UuidParamInput; Body: UpdateSlaughterInput }>('/api/v1/livestock/slaughter/:id', {
    schema: { params: UuidParamSchema, body: UpdateSlaughterSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.slaughterService.update(request.params.id, request.body, user);
  });
}
