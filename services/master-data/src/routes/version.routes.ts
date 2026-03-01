import type { FastifyInstance } from 'fastify';

export async function registerVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/master-data/version', {
    preHandler: [app.authHookFn],
  }, async () => {
    return app.versionService.getVersion();
  });
}
