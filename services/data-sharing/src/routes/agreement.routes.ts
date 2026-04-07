import type { FastifyInstance } from 'fastify';
import { UserRole } from '@aris/shared-types';
import { authHook, rolesHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import type {
  CreateDataShareAgreementDto,
  UpdateDataShareAgreementDto,
  RejectAgreementDto,
  RevokeAgreementDto,
  ShareStatus,
} from '@aris/shared-types';

export async function registerAgreementRoutes(app: FastifyInstance): Promise<void> {
  const authOpts: AuthHookOptions = {
    publicKey: (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n'),
  };
  const auth = app.authHookFn ?? authHook(authOpts);
  const tenant = tenantHook();

  const WRITE_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.CONTINENTAL_ADMIN,
    UserRole.REC_ADMIN,
    UserRole.NATIONAL_ADMIN,
    UserRole.DATA_STEWARD,
  ];

  // POST /api/v1/data-sharing/agreements
  app.post('/api/v1/data-sharing/agreements', {
    preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.agreementService.create(
      request.body as CreateDataShareAgreementDto,
      user,
    );
    return reply.code(201).send(result);
  });

  // GET /api/v1/data-sharing/agreements
  app.get('/api/v1/data-sharing/agreements', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const q = request.query as Record<string, string>;
    return app.agreementService.findAll(user, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      sort: q.sort,
      order: q.order as 'asc' | 'desc' | undefined,
      status: q.status as ShareStatus | undefined,
      dataDomain: q.dataDomain,
      role: q.role as 'sent' | 'received' | 'all' | undefined,
    });
  });

  // GET /api/v1/data-sharing/agreements/:id
  app.get<{ Params: { id: string } }>(
    '/api/v1/data-sharing/agreements/:id',
    { preHandler: [auth, tenant] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.agreementService.findOne(request.params.id, user);
    },
  );

  // PUT /api/v1/data-sharing/agreements/:id
  app.put<{ Params: { id: string }; Body: UpdateDataShareAgreementDto }>(
    '/api/v1/data-sharing/agreements/:id',
    { preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.agreementService.update(request.params.id, request.body, user);
    },
  );

  // POST /api/v1/data-sharing/agreements/:id/submit
  app.post<{ Params: { id: string } }>(
    '/api/v1/data-sharing/agreements/:id/submit',
    { preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.agreementService.submit(request.params.id, user);
    },
  );

  // POST /api/v1/data-sharing/agreements/:id/accept
  app.post<{ Params: { id: string } }>(
    '/api/v1/data-sharing/agreements/:id/accept',
    { preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.agreementService.accept(request.params.id, user);
    },
  );

  // POST /api/v1/data-sharing/agreements/:id/reject
  app.post<{ Params: { id: string }; Body: RejectAgreementDto }>(
    '/api/v1/data-sharing/agreements/:id/reject',
    { preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.agreementService.reject(request.params.id, request.body, user);
    },
  );

  // POST /api/v1/data-sharing/agreements/:id/revoke
  app.post<{ Params: { id: string }; Body: RevokeAgreementDto }>(
    '/api/v1/data-sharing/agreements/:id/revoke',
    { preHandler: [auth, tenant, rolesHook(...WRITE_ROLES)] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.agreementService.revoke(request.params.id, request.body, user);
    },
  );

  // GET /api/v1/data-sharing/agreements/:id/data
  app.get<{ Params: { id: string } }>(
    '/api/v1/data-sharing/agreements/:id/data',
    { preHandler: [auth, tenant] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const filters = (request.query as Record<string, unknown>) ?? {};
      return app.agreementService.previewData(request.params.id, user, filters);
    },
  );

  // GET /api/v1/data-sharing/agreements/:id/export
  app.get<{ Params: { id: string } }>(
    '/api/v1/data-sharing/agreements/:id/export',
    { preHandler: [auth, tenant] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const q = request.query as Record<string, string>;
      const format = (q.format === 'csv' ? 'csv' : 'json') as 'json' | 'csv';
      return app.agreementService.exportData(request.params.id, user, format);
    },
  );

  // GET /api/v1/data-sharing/agreements/:id/logs
  app.get<{ Params: { id: string } }>(
    '/api/v1/data-sharing/agreements/:id/logs',
    { preHandler: [auth, tenant] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const q = request.query as Record<string, string>;
      return app.accessLogService.findByAgreement(request.params.id, user, {
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
    },
  );
}
