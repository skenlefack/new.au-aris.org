import type { FastifyInstance } from 'fastify';
import { tenantHook, rolesHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  TransactionQuerySchema,
  TransactionIdParamSchema,
  type TransactionQueryInput,
  type TransactionIdParam,
} from '../schemas/transaction.schemas.js';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTINENTAL_ADMIN,
  UserRole.REC_ADMIN,
  UserRole.NATIONAL_ADMIN,
  UserRole.DATA_STEWARD,
];

export async function registerTransactionRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // GET /api/v1/interop-v2/transactions
  app.get<{ Querystring: TransactionQueryInput }>('/api/v1/interop-v2/transactions', {
    schema: { querystring: TransactionQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.transactionService.findAll(user, request.query);
  });

  // GET /api/v1/interop-v2/transactions/:id
  app.get<{ Params: TransactionIdParam }>('/api/v1/interop-v2/transactions/:id', {
    schema: { params: TransactionIdParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.transactionService.findOne(request.params.id, user);
  });

  // POST /api/v1/interop-v2/transactions/:id/retry
  app.post<{ Params: TransactionIdParam }>('/api/v1/interop-v2/transactions/:id/retry', {
    schema: { params: TransactionIdParamSchema },
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.transactionService.retry(request.params.id, user);
  });
}
