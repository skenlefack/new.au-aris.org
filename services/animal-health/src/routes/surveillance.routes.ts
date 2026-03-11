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
  CreateSurveillanceSchema,
  UpdateSurveillanceSchema,
  SurveillanceFilterSchema,
  type CreateSurveillanceInput,
  type UpdateSurveillanceInput,
  type SurveillanceFilterInput,
} from '../schemas/surveillance.schema.js';

export async function registerSurveillanceRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/animal-health/surveillance
  app.post<{ Body: CreateSurveillanceInput }>(
    '/api/v1/animal-health/surveillance',
    {
      schema: { body: CreateSurveillanceSchema },
      preHandler: [
        ...authAndTenant,
        rolesHook(
          UserRole.SUPER_ADMIN,
          UserRole.CONTINENTAL_ADMIN,
          UserRole.REC_ADMIN,
          UserRole.NATIONAL_ADMIN,
          UserRole.DATA_STEWARD,
          UserRole.FIELD_AGENT,
        ),
      ],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await app.surveillanceService.create(request.body, user);
      return reply.code(201).send(result);
    },
  );

  // GET /api/v1/animal-health/surveillance
  app.get<{ Querystring: PaginationQueryInput & SurveillanceFilterInput }>(
    '/api/v1/animal-health/surveillance',
    {
      schema: {
        querystring: {
          ...PaginationQuerySchema,
          ...SurveillanceFilterSchema,
        },
      },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const { page, limit, sort, order, ...filter } = request.query;
      return app.surveillanceService.findAll(user, { page, limit, sort, order }, filter);
    },
  );

  // GET /api/v1/animal-health/surveillance/:id
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/animal-health/surveillance/:id',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.surveillanceService.findOne(request.params.id, user);
    },
  );

  // PATCH /api/v1/animal-health/surveillance/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateSurveillanceInput }>(
    '/api/v1/animal-health/surveillance/:id',
    {
      schema: { params: UuidParamSchema, body: UpdateSurveillanceSchema },
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
      return app.surveillanceService.update(request.params.id, request.body, user);
    },
  );
}
