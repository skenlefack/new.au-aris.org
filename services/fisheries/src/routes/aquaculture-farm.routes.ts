import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateAquacultureFarmSchema,
  UpdateAquacultureFarmSchema,
  AquacultureFarmFilterSchema,
  UuidParamSchema,
  type CreateAquacultureFarmInput,
  type UpdateAquacultureFarmInput,
  type AquacultureFarmFilterInput,
  type UuidParamInput,
} from '../schemas/aquaculture-farm.schema.js';

export async function registerAquacultureFarmRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/fisheries/aquaculture/farms
  app.post<{ Body: CreateAquacultureFarmInput }>('/api/v1/fisheries/aquaculture/farms', {
    schema: { body: CreateAquacultureFarmSchema },
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
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.aquacultureFarmService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/fisheries/aquaculture/farms
  app.get<{ Querystring: AquacultureFarmFilterInput }>('/api/v1/fisheries/aquaculture/farms', {
    schema: { querystring: AquacultureFarmFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.aquacultureFarmService.findAll(user, request.query);
  });

  // GET /api/v1/fisheries/aquaculture/farms/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/fisheries/aquaculture/farms/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.aquacultureFarmService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/fisheries/aquaculture/farms/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateAquacultureFarmInput }>('/api/v1/fisheries/aquaculture/farms/:id', {
    schema: { params: UuidParamSchema, body: UpdateAquacultureFarmSchema },
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
    return app.aquacultureFarmService.update(request.params.id, request.body, user);
  });
}
