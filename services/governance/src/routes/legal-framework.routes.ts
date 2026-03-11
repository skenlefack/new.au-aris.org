import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateLegalFrameworkSchema,
  UpdateLegalFrameworkSchema,
  LegalFrameworkFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateLegalFrameworkInput,
  type UpdateLegalFrameworkInput,
  type LegalFrameworkFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/legal-framework.schema.js';

const PREFIX = '/api/v1/governance/legal-frameworks';

const CREATE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
  UserRole.FIELD_AGENT,
];

const UPDATE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerLegalFrameworkRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/governance/legal-frameworks -- create legal framework
  app.post<{ Body: CreateLegalFrameworkInput }>(PREFIX, {
    schema: { body: CreateLegalFrameworkSchema },
    preHandler: [...authAndTenant, rolesHook(...CREATE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.legalFrameworkService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/governance/legal-frameworks -- list legal frameworks
  app.get<{ Querystring: PaginationQueryInput & LegalFrameworkFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...LegalFrameworkFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...LegalFrameworkFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.legalFrameworkService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/governance/legal-frameworks/:id -- get legal framework by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.legalFrameworkService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/governance/legal-frameworks/:id -- update legal framework
  app.patch<{ Params: UuidParamInput; Body: UpdateLegalFrameworkInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateLegalFrameworkSchema },
    preHandler: [...authAndTenant, rolesHook(...UPDATE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.legalFrameworkService.update(request.params.id, request.body, user);
  });

  // POST /api/v1/governance/legal-frameworks/:id/adopt -- adopt legal framework
  app.post<{ Params: UuidParamInput }>(`${PREFIX}/:id/adopt`, {
    schema: { params: UuidParamSchema },
    preHandler: [...authAndTenant, rolesHook(...UPDATE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.legalFrameworkService.adopt(request.params.id, user);
  });
}
