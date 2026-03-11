import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateProtectedAreaSchema,
  UpdateProtectedAreaSchema,
  ProtectedAreaFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateProtectedAreaInput,
  type UpdateProtectedAreaInput,
  type ProtectedAreaFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/protected-area.schema.js';

export async function registerProtectedAreaRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/wildlife/protected-areas — create protected area
  app.post<{ Body: CreateProtectedAreaInput }>('/api/v1/wildlife/protected-areas', {
    schema: { body: CreateProtectedAreaSchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
    )],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.protectedAreaService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/wildlife/protected-areas — list protected areas
  app.get<{ Querystring: PaginationQueryInput & ProtectedAreaFilterInput }>('/api/v1/wildlife/protected-areas', {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...ProtectedAreaFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...ProtectedAreaFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.protectedAreaService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/wildlife/protected-areas/:id — get protected area by ID
  app.get<{ Params: UuidParamInput }>('/api/v1/wildlife/protected-areas/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.protectedAreaService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/wildlife/protected-areas/:id — update protected area
  app.patch<{ Params: UuidParamInput; Body: UpdateProtectedAreaInput }>('/api/v1/wildlife/protected-areas/:id', {
    schema: { params: UuidParamSchema, body: UpdateProtectedAreaSchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
    )],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.protectedAreaService.update(request.params.id, request.body, user);
  });
}
