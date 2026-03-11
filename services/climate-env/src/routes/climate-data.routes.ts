import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateClimateDataSchema,
  UpdateClimateDataSchema,
  ClimateDataFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateClimateDataInput,
  type UpdateClimateDataInput,
  type ClimateDataFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/climate-data.schema.js';

const PREFIX = '/api/v1/climate/data';

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

export async function registerClimateDataRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/climate/data -- create climate data point
  app.post<{ Body: CreateClimateDataInput }>(PREFIX, {
    schema: { body: CreateClimateDataSchema },
    preHandler: [...authAndTenant, rolesHook(...CREATE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.climateDataService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/climate/data -- list climate data points
  app.get<{ Querystring: PaginationQueryInput & ClimateDataFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...ClimateDataFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...ClimateDataFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.climateDataService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/climate/data/:id -- get climate data point by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.climateDataService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/climate/data/:id -- update climate data point
  app.patch<{ Params: UuidParamInput; Body: UpdateClimateDataInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateClimateDataSchema },
    preHandler: [...authAndTenant, rolesHook(...UPDATE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.climateDataService.update(request.params.id, request.body, user);
  });
}
