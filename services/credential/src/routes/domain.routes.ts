import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  SetUserDomainsSchema,
  UserIdParamSchema,
  type SetUserDomainsInput,
  type UserIdParamInput,
} from '../schemas/domain.schemas.js';

export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  // GET /api/v1/public/domains — list all active domains (no auth required, for dashboard)
  app.get('/api/v1/public/domains', async () => {
    return app.domainService.listDomains();
  });

  // GET /api/v1/credential/domains — list all active domains (authenticated)
  app.get('/api/v1/credential/domains', {
    preHandler: [app.authHookFn],
  }, async () => {
    return app.domainService.listDomains();
  });

  // GET /api/v1/credential/users/:userId/domains — get user's assigned domains
  app.get<{ Params: UserIdParamInput }>('/api/v1/credential/users/:userId/domains', {
    schema: { params: UserIdParamSchema },
    preHandler: authAndTenant,
  }, async (request) => {
    return app.domainService.getUserDomains(request.params.userId);
  });

  // PUT /api/v1/credential/users/:userId/domains — set user's domains (admin only)
  app.put<{ Params: UserIdParamInput; Body: SetUserDomainsInput }>('/api/v1/credential/users/:userId/domains', {
    schema: { params: UserIdParamSchema, body: SetUserDomainsSchema },
    preHandler: [
      ...authAndTenant,
      rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.REC_ADMIN, UserRole.NATIONAL_ADMIN),
    ],
  }, async (request) => {
    const caller = request.user as AuthenticatedUser;
    return app.domainService.setUserDomains(
      request.params.userId,
      request.body.domainIds,
      caller.userId,
      caller.tenantId,
    );
  });
}
