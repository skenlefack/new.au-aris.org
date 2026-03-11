import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  PaginationQuerySchema,
  UuidParamSchema,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/health-event.schema.js';
import {
  CreateCapacitySchema,
  UpdateCapacitySchema,
  CapacityFilterSchema,
  type CreateCapacityInput,
  type UpdateCapacityInput,
  type CapacityFilterInput,
} from '../schemas/capacity.schema.js';

export async function registerCapacityRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/animal-health/capacities
  app.post<{ Body: CreateCapacityInput }>(
    '/api/v1/animal-health/capacities',
    {
      schema: { body: CreateCapacitySchema },
      preHandler: [
        ...authAndTenant,
        rolesHook(
          UserRole.SUPER_ADMIN,
          UserRole.CONTINENTAL_ADMIN,
          UserRole.REC_ADMIN,
          UserRole.NATIONAL_ADMIN,
          UserRole.DATA_STEWARD,
        ),
      ],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await app.capacityService.create(request.body, user);
      return reply.code(201).send(result);
    },
  );

  // GET /api/v1/animal-health/capacities
  app.get<{ Querystring: PaginationQueryInput & CapacityFilterInput }>(
    '/api/v1/animal-health/capacities',
    {
      schema: {
        querystring: {
          ...PaginationQuerySchema,
          ...CapacityFilterSchema,
        },
      },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const { page, limit, sort, order, ...filter } = request.query;
      return app.capacityService.findAll(user, { page, limit, sort, order }, filter);
    },
  );

  // GET /api/v1/animal-health/capacities/:id
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/animal-health/capacities/:id',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.capacityService.findOne(request.params.id, user);
    },
  );

  // PATCH /api/v1/animal-health/capacities/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateCapacityInput }>(
    '/api/v1/animal-health/capacities/:id',
    {
      schema: { params: UuidParamSchema, body: UpdateCapacitySchema },
      preHandler: [
        ...authAndTenant,
        rolesHook(
          UserRole.SUPER_ADMIN,
          UserRole.CONTINENTAL_ADMIN,
          UserRole.REC_ADMIN,
          UserRole.NATIONAL_ADMIN,
          UserRole.DATA_STEWARD,
        ),
      ],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.capacityService.update(request.params.id, request.body, user);
    },
  );
}
