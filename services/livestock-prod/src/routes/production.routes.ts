import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateProductionSchema,
  UpdateProductionSchema,
  ProductionFilterSchema,
  UuidParamSchema,
  type CreateProductionInput,
  type UpdateProductionInput,
  type ProductionFilterInput,
  type UuidParamInput,
} from '../schemas/production.schema.js';

export async function registerProductionRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/livestock/production — create production record
  app.post<{ Body: CreateProductionInput }>('/api/v1/livestock/production', {
    schema: { body: CreateProductionSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.productionService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/livestock/production — list production records
  app.get<{ Querystring: ProductionFilterInput }>('/api/v1/livestock/production', {
    schema: { querystring: ProductionFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.productionService.findAll(user, request.query);
  });

  // GET /api/v1/livestock/production/:id — get production record by id
  app.get<{ Params: UuidParamInput }>('/api/v1/livestock/production/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.productionService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/livestock/production/:id — update production record
  app.patch<{ Params: UuidParamInput; Body: UpdateProductionInput }>('/api/v1/livestock/production/:id', {
    schema: { params: UuidParamSchema, body: UpdateProductionSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.productionService.update(request.params.id, request.body, user);
  });
}
