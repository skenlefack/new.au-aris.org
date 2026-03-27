import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateEffortSchema,
  UpdateEffortSchema,
  EffortFilterSchema,
  UuidParamSchema,
  type CreateEffortInput,
  type UpdateEffortInput,
  type EffortFilterInput,
  type UuidParamInput,
} from '../schemas/effort.schema.js';

export async function registerEffortRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('fisheries')];

  // POST /api/v1/fisheries/efforts
  app.post<{ Body: CreateEffortInput }>('/api/v1/fisheries/efforts', {
    schema: { body: CreateEffortSchema },
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
    const result = await app.effortService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/fisheries/efforts
  app.get<{ Querystring: EffortFilterInput }>('/api/v1/fisheries/efforts', {
    schema: { querystring: EffortFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.effortService.findAll(user, request.query);
  });

  // GET /api/v1/fisheries/efforts/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/fisheries/efforts/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.effortService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/fisheries/efforts/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateEffortInput }>('/api/v1/fisheries/efforts/:id', {
    schema: { params: UuidParamSchema, body: UpdateEffortSchema },
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
    return app.effortService.update(request.params.id, request.body, user);
  });

  // DELETE /api/v1/fisheries/efforts/:id
  app.delete<{ Params: UuidParamInput }>('/api/v1/fisheries/efforts/:id', {
    schema: { params: UuidParamSchema },
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
    return app.effortService.delete(request.params.id, user);
  });
}
