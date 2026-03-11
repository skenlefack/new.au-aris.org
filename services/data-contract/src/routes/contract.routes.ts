import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';

export async function registerContractRoutes(app: FastifyInstance): Promise<void> {
  const authOpts: AuthHookOptions = {
    publicKey: (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n'),
  };
  const auth = app.authHookFn ?? authHook(authOpts);
  const tenant = tenantHook();

  const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN];

  // POST /api/v1/data-contracts - create contract
  app.post('/api/v1/data-contracts', {
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.contractService.create(request.body as any, user);
    return reply.code(201).send(result);
  });

  // GET /api/v1/data-contracts - list contracts
  app.get('/api/v1/data-contracts', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as Record<string, string>;
    return app.contractService.findAll(user, {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      sort: query.sort,
      order: query.order as 'asc' | 'desc' | undefined,
      domain: query.domain,
      status: query.status,
      owner: query.owner,
    });
  });

  // GET /api/v1/data-contracts/:id - get contract
  app.get<{ Params: { id: string } }>('/api/v1/data-contracts/:id', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.contractService.findOne(request.params.id, user);
  });

  // PATCH /api/v1/data-contracts/:id - update contract (creates new version)
  app.patch<{ Params: { id: string } }>('/api/v1/data-contracts/:id', {
    preHandler: [auth, tenant, rolesHook(...ADMIN_ROLES)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.contractService.update(request.params.id, request.body as any, user);
  });

  // GET /api/v1/data-contracts/:id/compliance - get compliance metrics
  app.get<{ Params: { id: string } }>('/api/v1/data-contracts/:id/compliance', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const query = request.query as Record<string, string>;
    const days = query.days ? Number(query.days) : undefined;
    return app.complianceService.getCompliance(request.params.id, user, days);
  });
}
