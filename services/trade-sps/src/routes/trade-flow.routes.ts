import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateTradeFlowSchema,
  UpdateTradeFlowSchema,
  TradeFlowFilterSchema,
  UuidParamSchema,
  type CreateTradeFlowInput,
  type UpdateTradeFlowInput,
  type TradeFlowFilterInput,
  type UuidParamInput,
} from '../schemas/trade-flow.schema.js';

const ALLOWED_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
] as const;

export async function registerTradeFlowRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/trade/flows — create trade flow
  app.post<{ Body: CreateTradeFlowInput }>('/api/v1/trade/flows', {
    schema: { body: CreateTradeFlowSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.tradeFlowService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/trade/flows — list trade flows
  app.get<{ Querystring: TradeFlowFilterInput }>('/api/v1/trade/flows', {
    schema: { querystring: TradeFlowFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tradeFlowService.findAll(user, request.query);
  });

  // GET /api/v1/trade/flows/:id — get trade flow by id
  app.get<{ Params: UuidParamInput }>('/api/v1/trade/flows/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tradeFlowService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/trade/flows/:id — update trade flow
  app.patch<{ Params: UuidParamInput; Body: UpdateTradeFlowInput }>('/api/v1/trade/flows/:id', {
    schema: { params: UuidParamSchema, body: UpdateTradeFlowSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.tradeFlowService.update(request.params.id, request.body, user);
  });
}
