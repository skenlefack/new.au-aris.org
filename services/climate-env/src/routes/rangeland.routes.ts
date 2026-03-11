import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateRangelandSchema,
  UpdateRangelandSchema,
  RangelandFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateRangelandInput,
  type UpdateRangelandInput,
  type RangelandFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/rangeland.schema.js';

const PREFIX = '/api/v1/climate/rangelands';

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

export async function registerRangelandRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/climate/rangelands -- create rangeland assessment
  app.post<{ Body: CreateRangelandInput }>(PREFIX, {
    schema: { body: CreateRangelandSchema },
    preHandler: [...authAndTenant, rolesHook(...CREATE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.rangelandService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/climate/rangelands -- list rangeland conditions
  app.get<{ Querystring: PaginationQueryInput & RangelandFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...RangelandFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...RangelandFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.rangelandService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/climate/rangelands/:id -- get rangeland condition by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.rangelandService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/climate/rangelands/:id -- update rangeland condition
  app.patch<{ Params: UuidParamInput; Body: UpdateRangelandInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateRangelandSchema },
    preHandler: [...authAndTenant, rolesHook(...UPDATE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.rangelandService.update(request.params.id, request.body, user);
  });
}
