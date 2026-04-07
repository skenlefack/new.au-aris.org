import type { FastifyInstance } from 'fastify';
import { authHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const authOpts: AuthHookOptions = {
    publicKey: (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n'),
  };
  const auth = app.authHookFn ?? authHook(authOpts);
  const tenant = tenantHook();

  // GET /api/v1/data-sharing/dashboard
  app.get('/api/v1/data-sharing/dashboard', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const stats = await app.dashboardService.getStats(user);
    return { data: stats };
  });
}
