import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerIdentifierRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const roles = rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.NATIONAL_ADMIN);

  app.post<{ Body: any }>('/api/v1/master-data/identifiers', {
    preHandler: [...authAndTenant, roles],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.identifierService.create(request.body, user));
  });

  app.get<{ Querystring: { page?: string; limit?: string; sort?: string; order?: string; type?: string; geoEntityId?: string; search?: string } }>('/api/v1/master-data/identifiers', {
    preHandler: authAndTenant,
  }, async (request) => {
    const q = request.query;
    return app.identifierService.findAll({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      sort: q.sort, order: q.order as any,
      type: q.type, geoEntityId: q.geoEntityId, search: q.search,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/master-data/identifiers/:id', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.identifierService.findOne(request.params.id);
  });

  app.patch<{ Params: { id: string }; Body: any }>('/api/v1/master-data/identifiers/:id', {
    preHandler: [...authAndTenant, roles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.identifierService.update(request.params.id, request.body, user);
  });
}
