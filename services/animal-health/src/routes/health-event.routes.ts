import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateHealthEventSchema,
  UpdateHealthEventSchema,
  HealthEventFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateHealthEventInput,
  type UpdateHealthEventInput,
  type HealthEventFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/health-event.schema.js';

export async function registerHealthEventRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/animal-health/events
  app.post<{ Body: CreateHealthEventInput }>(
    '/api/v1/animal-health/events',
    {
      schema: { body: CreateHealthEventSchema },
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
      const result = await app.healthEventService.create(request.body, user);
      return reply.code(201).send(result);
    },
  );

  // GET /api/v1/animal-health/events
  app.get<{ Querystring: PaginationQueryInput & HealthEventFilterInput }>(
    '/api/v1/animal-health/events',
    {
      schema: {
        querystring: {
          ...PaginationQuerySchema,
          ...HealthEventFilterSchema,
        },
      },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const { page, limit, sort, order, ...filter } = request.query;
      return app.healthEventService.findAll(user, { page, limit, sort, order }, filter);
    },
  );

  // GET /api/v1/animal-health/events/markers (MUST be before /:id)
  app.get(
    '/api/v1/animal-health/events/markers',
    { preHandler: authAndTenant },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.healthEventService.findMarkers(user);
    },
  );

  // GET /api/v1/animal-health/events/:id
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/animal-health/events/:id',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.healthEventService.findOne(request.params.id, user);
    },
  );

  // PATCH /api/v1/animal-health/events/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateHealthEventInput }>(
    '/api/v1/animal-health/events/:id',
    {
      schema: { params: UuidParamSchema, body: UpdateHealthEventSchema },
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
      return app.healthEventService.update(request.params.id, request.body, user);
    },
  );

  // POST /api/v1/animal-health/events/:id/confirm
  app.post<{ Params: UuidParamInput }>(
    '/api/v1/animal-health/events/:id/confirm',
    {
      schema: { params: UuidParamSchema },
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
      return app.healthEventService.confirm(request.params.id, user);
    },
  );
}
