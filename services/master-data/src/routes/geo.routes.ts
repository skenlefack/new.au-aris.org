import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerGeoRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminRoles = rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN);

  app.post<{ Body: any }>('/api/v1/master-data/geo', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.geoService.create(request.body, user);
    return reply.code(201).send(result);
  });

  app.get<{ Querystring: { page?: string; limit?: string; sort?: string; order?: string; level?: string; countryCode?: string; parentId?: string; search?: string } }>('/api/v1/master-data/geo', {
    preHandler: authAndTenant,
  }, async (request) => {
    const q = request.query;
    return app.geoService.findAll({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      sort: q.sort, order: q.order as any,
      level: q.level, countryCode: q.countryCode, parentId: q.parentId, search: q.search,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/master-data/geo/:id', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.geoService.findOne(request.params.id);
  });

  app.get<{ Params: { code: string } }>('/api/v1/master-data/geo/code/:code', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.geoService.findByCode(request.params.code);
  });

  app.patch<{ Params: { id: string }; Body: any }>('/api/v1/master-data/geo/:id', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.geoService.update(request.params.id, request.body, user);
  });

  app.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>('/api/v1/master-data/geo/:id/children', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.geoService.findChildren(request.params.id, {
      page: request.query.page ? parseInt(request.query.page, 10) : undefined,
      limit: request.query.limit ? parseInt(request.query.limit, 10) : undefined,
    });
  });
}
