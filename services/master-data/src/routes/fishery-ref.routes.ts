import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerFisheryRefRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const adminRoles = rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN);

  // List (paginated, filtered by category, search, isActive)
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
      category?: string;
      search?: string;
      isActive?: string;
    };
  }>('/api/v1/master-data/fishery-referentials', {
    preHandler: authAndTenant,
  }, async (request) => {
    const q = request.query;
    return app.fisheryRefService.findAll({
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      sort: q.sort,
      order: q.order as any,
      category: q.category,
      search: q.search,
      isActive: q.isActive === 'true' ? true : q.isActive === 'false' ? false : undefined,
    });
  });

  // Detail
  app.get<{ Params: { id: string } }>('/api/v1/master-data/fishery-referentials/:id', {
    preHandler: authAndTenant,
  }, async (request) => {
    return app.fisheryRefService.findOne(request.params.id);
  });

  // Create (admin only)
  app.post<{ Body: any }>('/api/v1/master-data/fishery-referentials', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    return reply.code(201).send(await app.fisheryRefService.create(request.body, user));
  });

  // Update (admin only)
  app.patch<{ Params: { id: string }; Body: any }>('/api/v1/master-data/fishery-referentials/:id', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.fisheryRefService.update(request.params.id, request.body, user);
  });

  // Delete — soft delete (admin only)
  app.delete<{ Params: { id: string } }>('/api/v1/master-data/fishery-referentials/:id', {
    preHandler: [...authAndTenant, adminRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.fisheryRefService.delete(request.params.id, user);
  });
}
