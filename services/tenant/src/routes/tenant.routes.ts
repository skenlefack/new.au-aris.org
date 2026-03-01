import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateTenantInput,
  type UpdateTenantInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/tenant.schemas.js';

export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/tenants — create tenant (SUPER_ADMIN only)
  app.post<{ Body: CreateTenantInput }>('/api/v1/tenants', {
    schema: { body: CreateTenantSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.tenantService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/tenants — list tenants
  app.get<{ Querystring: PaginationQueryInput }>('/api/v1/tenants', {
    schema: { querystring: PaginationQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tenantService.findAll(user, request.query);
  });

  // GET /api/v1/tenants/:id
  app.get<{ Params: UuidParamInput }>('/api/v1/tenants/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tenantService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/tenants/:id — update tenant
  app.patch<{ Params: UuidParamInput; Body: UpdateTenantInput }>('/api/v1/tenants/:id', {
    schema: { params: UuidParamSchema, body: UpdateTenantSchema },
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tenantService.update(request.params.id, request.body, user);
  });

  // GET /api/v1/tenants/:id/children
  app.get<{ Params: UuidParamInput; Querystring: PaginationQueryInput }>('/api/v1/tenants/:id/children', {
    schema: { params: UuidParamSchema, querystring: PaginationQuerySchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tenantService.findChildren(request.params.id, user, request.query);
  });
}
