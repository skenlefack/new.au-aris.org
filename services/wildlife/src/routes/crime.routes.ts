import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCrimeSchema,
  UpdateCrimeSchema,
  CrimeFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateCrimeInput,
  type UpdateCrimeInput,
  type CrimeFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/crime.schema.js';

export async function registerCrimeRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/wildlife/crimes — create wildlife crime report
  app.post<{ Body: CreateCrimeInput }>('/api/v1/wildlife/crimes', {
    schema: { body: CreateCrimeSchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
      UserRole.FIELD_AGENT,
    )],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.crimeService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/wildlife/crimes — list wildlife crimes
  app.get<{ Querystring: PaginationQueryInput & CrimeFilterInput }>('/api/v1/wildlife/crimes', {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...CrimeFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...CrimeFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.crimeService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/wildlife/crimes/:id — get wildlife crime by ID
  app.get<{ Params: UuidParamInput }>('/api/v1/wildlife/crimes/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.crimeService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/wildlife/crimes/:id — update wildlife crime report
  app.patch<{ Params: UuidParamInput; Body: UpdateCrimeInput }>('/api/v1/wildlife/crimes/:id', {
    schema: { params: UuidParamSchema, body: UpdateCrimeSchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
    )],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.crimeService.update(request.params.id, request.body, user);
  });
}
