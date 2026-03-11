import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreatePvsEvaluationSchema,
  UpdatePvsEvaluationSchema,
  PvsEvaluationFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreatePvsEvaluationInput,
  type UpdatePvsEvaluationInput,
  type PvsEvaluationFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/pvs-evaluation.schema.js';

const PREFIX = '/api/v1/governance/pvs-evaluations';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerPvsEvaluationRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/governance/pvs-evaluations -- create PVS evaluation
  app.post<{ Body: CreatePvsEvaluationInput }>(PREFIX, {
    schema: { body: CreatePvsEvaluationSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.pvsEvaluationService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/governance/pvs-evaluations -- list PVS evaluations
  app.get<{ Querystring: PaginationQueryInput & PvsEvaluationFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...PvsEvaluationFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...PvsEvaluationFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.pvsEvaluationService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/governance/pvs-evaluations/:id -- get PVS evaluation by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.pvsEvaluationService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/governance/pvs-evaluations/:id -- update PVS evaluation
  app.patch<{ Params: UuidParamInput; Body: UpdatePvsEvaluationInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdatePvsEvaluationSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.pvsEvaluationService.update(request.params.id, request.body, user);
  });
}
