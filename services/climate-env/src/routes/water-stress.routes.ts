import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateWaterStressSchema,
  UpdateWaterStressSchema,
  WaterStressFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateWaterStressInput,
  type UpdateWaterStressInput,
  type WaterStressFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/water-stress.schema.js';

const PREFIX = '/api/v1/climate/water-stress';

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

export async function registerWaterStressRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/climate/water-stress -- create water stress index
  app.post<{ Body: CreateWaterStressInput }>(PREFIX, {
    schema: { body: CreateWaterStressSchema },
    preHandler: [...authAndTenant, rolesHook(...CREATE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.waterStressService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/climate/water-stress -- list water stress indices
  app.get<{ Querystring: PaginationQueryInput & WaterStressFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...WaterStressFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...WaterStressFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.waterStressService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/climate/water-stress/:id -- get water stress index by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.waterStressService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/climate/water-stress/:id -- update water stress index
  app.patch<{ Params: UuidParamInput; Body: UpdateWaterStressInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateWaterStressSchema },
    preHandler: [...authAndTenant, rolesHook(...UPDATE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.waterStressService.update(request.params.id, request.body, user);
  });
}
