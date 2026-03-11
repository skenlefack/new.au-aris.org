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
  CreateLabResultSchema,
  UpdateLabResultSchema,
  LabResultFilterSchema,
  type CreateLabResultInput,
  type UpdateLabResultInput,
  type LabResultFilterInput,
} from '../schemas/lab-result.schema.js';

export async function registerLabResultRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/animal-health/lab-results
  app.post<{ Body: CreateLabResultInput }>(
    '/api/v1/animal-health/lab-results',
    {
      schema: { body: CreateLabResultSchema },
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
      const result = await app.labResultService.create(request.body, user);
      return reply.code(201).send(result);
    },
  );

  // GET /api/v1/animal-health/lab-results
  app.get<{ Querystring: PaginationQueryInput & LabResultFilterInput }>(
    '/api/v1/animal-health/lab-results',
    {
      schema: {
        querystring: {
          ...PaginationQuerySchema,
          ...LabResultFilterSchema,
        },
      },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const { page, limit, sort, order, ...filter } = request.query;
      return app.labResultService.findAll(user, { page, limit, sort, order }, filter);
    },
  );

  // GET /api/v1/animal-health/lab-results/:id
  app.get<{ Params: UuidParamInput }>(
    '/api/v1/animal-health/lab-results/:id',
    {
      schema: { params: UuidParamSchema },
      preHandler: authAndTenant,
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.labResultService.findOne(request.params.id, user);
    },
  );

  // PATCH /api/v1/animal-health/lab-results/:id
  app.patch<{ Params: UuidParamInput; Body: UpdateLabResultInput }>(
    '/api/v1/animal-health/lab-results/:id',
    {
      schema: { params: UuidParamSchema, body: UpdateLabResultSchema },
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
      return app.labResultService.update(request.params.id, request.body, user);
    },
  );
}
