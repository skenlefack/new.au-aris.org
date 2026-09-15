import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerVersionRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;

  // GET /api/v1/workflow/definitions/:id/versions
  app.get<{ Params: { id: string } }>(
    '/api/v1/workflow/definitions/:id/versions',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.versionService.listVersions(request.params.id, user);
    },
  );

  // GET /api/v1/workflow/definitions/:id/versions/diff?a=X&b=Y
  // NOTE: This must be registered BEFORE the :version param route
  app.get<{ Params: { id: string }; Querystring: { a: string; b: string } }>(
    '/api/v1/workflow/definitions/:id/versions/diff',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const a = parseInt(request.query.a, 10);
      const b = parseInt(request.query.b, 10);
      if (isNaN(a) || isNaN(b)) {
        return { statusCode: 400, message: 'Query params a and b must be integers' };
      }
      return app.versionService.diffVersions(request.params.id, a, b, user);
    },
  );

  // GET /api/v1/workflow/definitions/:id/versions/:version
  app.get<{ Params: { id: string; version: string } }>(
    '/api/v1/workflow/definitions/:id/versions/:version',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const version = parseInt(request.params.version, 10);
      if (isNaN(version)) {
        return { statusCode: 400, message: 'Version must be an integer' };
      }
      return app.versionService.getVersion(request.params.id, version, user);
    },
  );

  // POST /api/v1/workflow/definitions/:id/versions/:version/restore
  app.post<{ Params: { id: string; version: string } }>(
    '/api/v1/workflow/definitions/:id/versions/:version/restore',
    { preHandler: [auth] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      const version = parseInt(request.params.version, 10);
      if (isNaN(version)) {
        return { statusCode: 400, message: 'Version must be an integer' };
      }
      return app.versionService.restoreVersion(request.params.id, version, user);
    },
  );
}
