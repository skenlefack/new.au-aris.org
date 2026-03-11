import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateAquacultureProductionSchema,
  UpdateAquacultureProductionSchema,
  AquacultureProductionFilterSchema,
  UuidParamSchema,
  type CreateAquacultureProductionInput,
  type UpdateAquacultureProductionInput,
  type AquacultureProductionFilterInput,
  type UuidParamInput,
} from '../schemas/aquaculture-production.schema.js';

export async function registerAquacultureProductionRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/fisheries/aquaculture/production
  app.post<{ Body: CreateAquacultureProductionInput }>('/api/v1/fisheries/aquaculture/production', {
    schema: { body: CreateAquacultureProductionSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
        UserRole.FIELD_AGENT,
      ),
    ],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.aquacultureProductionService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/fisheries/aquaculture/production
  app.get<{ Querystring: AquacultureProductionFilterInput }>('/api/v1/fisheries/aquaculture/production', {
    schema: { querystring: AquacultureProductionFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.aquacultureProductionService.findAll(user, request.query);
  });

  // GET /api/v1/fisheries/aquaculture/production/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/fisheries/aquaculture/production/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.aquacultureProductionService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/fisheries/aquaculture/production/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateAquacultureProductionInput }>('/api/v1/fisheries/aquaculture/production/:id', {
    schema: { params: UuidParamSchema, body: UpdateAquacultureProductionSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
        UserRole.REC_ADMIN,
        UserRole.NATIONAL_ADMIN,
        UserRole.DATA_STEWARD,
      ),
    ],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.aquacultureProductionService.update(request.params.id, request.body, user);
  });
}
