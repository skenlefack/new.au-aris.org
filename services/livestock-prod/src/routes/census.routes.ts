import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCensusSchema,
  UpdateCensusSchema,
  CensusFilterSchema,
  UuidParamSchema,
  type CreateCensusInput,
  type UpdateCensusInput,
  type CensusFilterInput,
  type UuidParamInput,
} from '../schemas/census.schema.js';

export async function registerCensusRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/livestock/census — create census record
  app.post<{ Body: CreateCensusInput }>('/api/v1/livestock/census', {
    schema: { body: CreateCensusSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.censusService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/livestock/census — list census records
  app.get<{ Querystring: CensusFilterInput }>('/api/v1/livestock/census', {
    schema: { querystring: CensusFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.censusService.findAll(user, request.query);
  });

  // GET /api/v1/livestock/census/:id — get census record by id
  app.get<{ Params: UuidParamInput }>('/api/v1/livestock/census/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.censusService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/livestock/census/:id — update census record
  app.patch<{ Params: UuidParamInput; Body: UpdateCensusInput }>('/api/v1/livestock/census/:id', {
    schema: { params: UuidParamSchema, body: UpdateCensusSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.DATA_STEWARD)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.censusService.update(request.params.id, request.body, user);
  });
}
