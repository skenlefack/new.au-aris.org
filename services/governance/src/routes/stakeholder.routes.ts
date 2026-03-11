import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateStakeholderSchema,
  UpdateStakeholderSchema,
  StakeholderFilterSchema,
  PaginationQuerySchema,
  UuidParamSchema,
  type CreateStakeholderInput,
  type UpdateStakeholderInput,
  type StakeholderFilterInput,
  type PaginationQueryInput,
  type UuidParamInput,
} from '../schemas/stakeholder.schema.js';

const PREFIX = '/api/v1/governance/stakeholders';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerStakeholderRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/governance/stakeholders -- create stakeholder
  app.post<{ Body: CreateStakeholderInput }>(PREFIX, {
    schema: { body: CreateStakeholderSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.stakeholderService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/governance/stakeholders -- list stakeholders
  app.get<{ Querystring: PaginationQueryInput & StakeholderFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...StakeholderFilterSchema,
        type: 'object' as const,
        properties: {
          ...PaginationQuerySchema.properties,
          ...StakeholderFilterSchema.properties,
        },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.stakeholderService.findAll(user, { page, limit, sort, order }, filter);
  });

  // GET /api/v1/governance/stakeholders/:id -- get stakeholder by ID
  app.get<{ Params: UuidParamInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.stakeholderService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/governance/stakeholders/:id -- update stakeholder
  app.patch<{ Params: UuidParamInput; Body: UpdateStakeholderInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateStakeholderSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.stakeholderService.update(request.params.id, request.body, user);
  });
}
