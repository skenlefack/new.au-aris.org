import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook, domainsHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateBudgetSchema, UpdateBudgetSchema, BudgetFilterSchema,
  type CreateBudgetInput, type UpdateBudgetInput, type BudgetFilterInput,
} from '../schemas/budget.schema.js';
import { PaginationQuerySchema, UuidParamSchema, type PaginationQueryInput, type UuidParamInput } from '../schemas/common.schema.js';

const PREFIX = '/api/v1/programme-monitoring/budgets';

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN,
];

export async function registerBudgetRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook(), domainsHook('programme-monitoring')];

  // POST — create budget line
  app.post<{ Body: CreateBudgetInput }>(PREFIX, {
    schema: { body: CreateBudgetSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.budgetService.create(request.body, user));
  });

  // GET — list budget lines
  app.get<{ Querystring: PaginationQueryInput & BudgetFilterInput }>(PREFIX, {
    schema: {
      querystring: {
        ...PaginationQuerySchema,
        ...BudgetFilterSchema,
        type: 'object' as const,
        properties: { ...PaginationQuerySchema.properties, ...BudgetFilterSchema.properties },
      },
    },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { page, limit, sort, order, ...filter } = request.query;
    return app.budgetService.findAll(user, { page, limit, sort, order }, filter);
  });

  // PATCH — update budget line
  app.patch<{ Params: UuidParamInput; Body: UpdateBudgetInput }>(`${PREFIX}/:id`, {
    schema: { params: UuidParamSchema, body: UpdateBudgetSchema },
    preHandler: [...authAndTenant, rolesHook(...WRITE_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.budgetService.update(request.params.id, request.body, user);
  });

  // GET — budget summary by output (for dashboard chart)
  app.get<{ Params: UuidParamInput }>(`/api/v1/programme-monitoring/programmes/:id/budget-summary`, {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.budgetService.summaryByOutput(request.params.id);
  });
}
