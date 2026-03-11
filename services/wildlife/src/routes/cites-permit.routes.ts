import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCitesPermitSchema,
  UpdateCitesPermitSchema,
  CitesPermitFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateCitesPermitInput,
  type UpdateCitesPermitInput,
  type CitesPermitFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/cites-permit.schema.js';

export async function registerCitesPermitRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/wildlife/cites-permits — create CITES permit
  app.post<{ Body: CreateCitesPermitInput }>('/api/v1/wildlife/cites-permits', {
    schema: { body: CreateCitesPermitSchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
      UserRole.WAHIS_FOCAL_POINT,
    )],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.citesPermitService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/wildlife/cites-permits — list CITES permits
  app.get<{ Querystring: PaginationQueryInput & CitesPermitFilterInput }>('/api/v1/wildlife/cites-permits', {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...CitesPermitFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...CitesPermitFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.citesPermitService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/wildlife/cites-permits/:id — get CITES permit by ID
  app.get<{ Params: UuidParamInput }>('/api/v1/wildlife/cites-permits/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.citesPermitService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/wildlife/cites-permits/:id — update CITES permit
  app.patch<{ Params: UuidParamInput; Body: UpdateCitesPermitInput }>('/api/v1/wildlife/cites-permits/:id', {
    schema: { params: UuidParamSchema, body: UpdateCitesPermitSchema },
    preHandler: [...authAndTenant, rolesHook(
      UserRole.SUPER_ADMIN,
      UserRole.CONTINENTAL_ADMIN,
      UserRole.REC_ADMIN,
      UserRole.NATIONAL_ADMIN,
      UserRole.DATA_STEWARD,
      UserRole.WAHIS_FOCAL_POINT,
    )],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.citesPermitService.update(request.params.id, request.body, user);
  });
}
