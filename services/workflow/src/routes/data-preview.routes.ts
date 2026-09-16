import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerDataPreviewRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;

  // GET /api/v1/workflow/definitions/:id/data-preview/schema
  app.get<{ Params: { id: string } }>(
    '/api/v1/workflow/definitions/:id/data-preview/schema',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.dataPreviewService.getSchemaPreview(request.params.id, user);
    },
  );

  // GET /api/v1/workflow/definitions/:id/data-preview/recent
  app.get<{ Params: { id: string } }>(
    '/api/v1/workflow/definitions/:id/data-preview/recent',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.dataPreviewService.getRecentSubmissions(request.params.id, user);
    },
  );

  // GET /api/v1/workflow/instances/:id/data-preview
  app.get<{ Params: { id: string } }>(
    '/api/v1/workflow/instances/:id/data-preview',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.dataPreviewService.getInstanceDataFlow(request.params.id, user);
    },
  );
}
