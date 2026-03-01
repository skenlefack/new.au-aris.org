import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerDiseaseRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminRoles = rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN);

  app.post<{ Body: any }>('/api/v1/master-data/diseases', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.diseaseService.create(request.body, user));
  });

  app.get<{ Querystring: { page?: string; limit?: string; sort?: string; order?: string; isWoahListed?: string; isNotifiable?: string; search?: string } }>('/api/v1/master-data/diseases', {
    preHandler: authAndTenant,
  }, async (request) => {
    const q = request.query;
    return app.diseaseService.findAll({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      sort: q.sort, order: q.order as any,
      isWoahListed: q.isWoahListed === 'true' ? true : q.isWoahListed === 'false' ? false : undefined,
      isNotifiable: q.isNotifiable === 'true' ? true : q.isNotifiable === 'false' ? false : undefined,
      search: q.search,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/master-data/diseases/:id', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.diseaseService.findOne(request.params.id);
  });

  app.patch<{ Params: { id: string }; Body: any }>('/api/v1/master-data/diseases/:id', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.diseaseService.update(request.params.id, request.body, user);
  });
}
