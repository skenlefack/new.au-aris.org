import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCapacitySchema,
  UpdateCapacitySchema,
  CapacityFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateCapacityInput,
  type UpdateCapacityInput,
  type CapacityFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/capacity.schema.js';

const PREFIX = '/api/v1/governance/capacities';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerCapacityRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/governance/capacities -- create capacity record
  app.post<{ Body: CreateCapacityInput }>(PREFIX, {
    schema: { body: CreateCapacitySchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.capacityService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/governance/capacities -- list capacity records
  app.get<{ Querystring: PaginationQueryInput & CapacityFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...CapacityFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...CapacityFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.capacityService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/governance/capacities/:id -- get capacity record by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.capacityService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/governance/capacities/:id -- update capacity record
  app.patch<{ Params: UuidParamInput; Body: UpdateCapacityInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateCapacitySchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.capacityService.update(request.params.id, request.body, user);
  });
}
