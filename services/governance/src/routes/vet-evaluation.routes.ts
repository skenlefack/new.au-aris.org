import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateVetEvaluationSchema,
  UpdateVetEvaluationSchema,
  VetEvaluationFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateVetEvaluationInput,
  type UpdateVetEvaluationInput,
  type VetEvaluationFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/vet-evaluation.schema.js';

const PREFIX = '/api/v1/governance/vet-evaluations';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerVetEvaluationRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('governance')];

  // POST /api/v1/governance/vet-evaluations -- create veterinary evaluation
  app.post<{ Body: CreateVetEvaluationInput }>(PREFIX, {
    schema: { body: CreateVetEvaluationSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.vetEvaluationService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/governance/vet-evaluations -- list veterinary evaluations
  app.get<{ Querystring: PaginationQueryInput & VetEvaluationFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...VetEvaluationFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...VetEvaluationFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.vetEvaluationService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/governance/vet-evaluations/:id -- get veterinary evaluation by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.vetEvaluationService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/governance/vet-evaluations/:id -- update veterinary evaluation
  app.patch<{ Params: UuidParamInput; Body: UpdateVetEvaluationInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateVetEvaluationSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.vetEvaluationService.update(request.params.id, request.body, user);
  });
}
