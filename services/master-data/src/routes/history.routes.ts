import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerHistoryRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];

  app.get<{ Params: { type: string; id: string }; Querystring: { page?: string; limit?: string } }>('/api/v1/master-data/history/:type/:id', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.historyService.getHistory(request.params.type, request.params.id, {
      page: request.query.page ? parseInt(request.query.page, 10) : undefined,
      limit: request.query.limit ? parseInt(request.query.limit, 10) : undefined,
    });
  });

  app.delete<{ Params: { type: string; id: string }; Body: { reason?: string } }>('/api/v1/master-data/history/:type/:id', {
    preHandler: [...authAndTenant, rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN)],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.historyService.softDelete(request.params.type, request.params.id, user, request.body?.reason);
  });
}
