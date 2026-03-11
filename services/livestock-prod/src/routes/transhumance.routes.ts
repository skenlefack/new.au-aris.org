import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateTranshumanceSchema,
  UpdateTranshumanceSchema,
  TranshumanceFilterSchema,
  UuidParamSchema,
  type CreateTranshumanceInput,
  type UpdateTranshumanceInput,
  type TranshumanceFilterInput,
  type UuidParamInput,
} from '../schemas/transhumance.schema.js';

export async function registerTranshumanceRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/livestock/transhumance — create transhumance corridor
  app.post<{ Body: CreateTranshumanceInput }>('/api/v1/livestock/transhumance', {
    schema: { body: CreateTranshumanceSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.transhumanceService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/livestock/transhumance — list transhumance corridors
  app.get<{ Querystring: TranshumanceFilterInput }>('/api/v1/livestock/transhumance', {
    schema: { querystring: TranshumanceFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.transhumanceService.findAll(user, request.query);
  });

  // GET /api/v1/livestock/transhumance/:id — get transhumance corridor by id
  app.get<{ Params: UuidParamInput }>('/api/v1/livestock/transhumance/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.transhumanceService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/livestock/transhumance/:id — update transhumance corridor
  app.patch<{ Params: UuidParamInput; Body: UpdateTranshumanceInput }>('/api/v1/livestock/transhumance/:id', {
    schema: { params: UuidParamSchema, body: UpdateTranshumanceSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.transhumanceService.update(request.params.id, request.body, user);
  });
}
