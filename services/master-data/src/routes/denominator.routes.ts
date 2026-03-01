import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerDenominatorRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const roles = rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD);

  app.post<{ Body: any }>('/api/v1/master-data/denominators', {
    preHandler: [...authAndTenant, roles],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.denominatorService.create(request.body, user));
  });

  app.get<{ Querystring: { page?: string; limit?: string; sort?: string; order?: string; countryCode?: string; speciesId?: string; year?: string; source?: string } }>('/api/v1/master-data/denominators', {
    preHandler: authAndTenant,
  }, async (request) => {
    const q = request.query;
    return app.denominatorService.findAll({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      sort: q.sort, order: q.order as any,
      countryCode: q.countryCode, speciesId: q.speciesId,
      year: q.year ? parseInt(q.year, 10) : undefined, source: q.source,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/master-data/denominators/:id', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.denominatorService.findOne(request.params.id);
  });

  app.patch<{ Params: { id: string }; Body: any }>('/api/v1/master-data/denominators/:id', {
    preHandler: [...authAndTenant, roles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.denominatorService.update(request.params.id, request.body, user);
  });

  app.post<{ Params: { id: string } }>('/api/v1/master-data/denominators/:id/validate', {
    preHandler: [...authAndTenant, roles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.denominatorService.validate(request.params.id, user);
  });
}
