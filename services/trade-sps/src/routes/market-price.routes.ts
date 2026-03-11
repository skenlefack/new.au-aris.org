import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateMarketPriceSchema,
  UpdateMarketPriceSchema,
  MarketPriceFilterSchema,
  UuidParamSchema,
  type CreateMarketPriceInput,
  type UpdateMarketPriceInput,
  type MarketPriceFilterInput,
  type UuidParamInput,
} from '../schemas/market-price.schema.js';

const ALLOWED_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
] as const;

export async function registerMarketPriceRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // POST /api/v1/trade/market-prices — create market price
  app.post<{ Body: CreateMarketPriceInput }>('/api/v1/trade/market-prices', {
    schema: { body: CreateMarketPriceSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.marketPriceService.create(request.body, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/trade/market-prices — list market prices
  app.get<{ Querystring: MarketPriceFilterInput }>('/api/v1/trade/market-prices', {
    schema: { querystring: MarketPriceFilterSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.marketPriceService.findAll(user, request.query);
  });

  // GET /api/v1/trade/market-prices/:id — get market price by id
  app.get<{ Params: UuidParamInput }>('/api/v1/trade/market-prices/:id', {
    schema: { params: UuidParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.marketPriceService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/trade/market-prices/:id — update market price
  app.patch<{ Params: UuidParamInput; Body: UpdateMarketPriceInput }>('/api/v1/trade/market-prices/:id', {
    schema: { params: UuidParamSchema, body: UpdateMarketPriceSchema },
    preHandler: [...authAndTenant, rolesHook(...ALLOWED_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.marketPriceService.update(request.params.id, request.body, user);
  });
}
