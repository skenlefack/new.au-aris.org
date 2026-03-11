import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateVesselSchema,
  UpdateVesselSchema,
  VesselFilterSchema,
  UuidParamSchema,
  type CreateVesselInput,
  type UpdateVesselInput,
  type VesselFilterInput,
  type UuidParamInput,
} from '../schemas/vessel.schema.js';

export async function registerVesselRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/fisheries/vessels
  app.post<{ Body: CreateVesselInput }>('/api/v1/fisheries/vessels', {
    schema: { body: CreateVesselSchema },
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
    const result = await app.vesselService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/fisheries/vessels
  app.get<{ Querystring: VesselFilterInput }>('/api/v1/fisheries/vessels', {
    schema: { querystring: VesselFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.vesselService.findAll(user, request.query);
  });

  // GET /api/v1/fisheries/vessels/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/fisheries/vessels/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.vesselService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/fisheries/vessels/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateVesselInput }>('/api/v1/fisheries/vessels/:id', {
    schema: { params: UuidParamSchema, body: UpdateVesselSchema },
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
    return app.vesselService.update(request.params.id, request.body, user);
  });
}
