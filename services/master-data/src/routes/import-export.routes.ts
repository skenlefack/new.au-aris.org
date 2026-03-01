import type { FastifyInstance } from 'fastify';
import { rolesHook, tenantHook } from '@aris/auth-middleware/fastify';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerImportExportRoutes(app: FastifyInstance): Promise<void> {
  const authAndTenant = [app.authHookFn, tenantHook()];
  const importRoles = rolesHook(UserRole.SUPER_ADMIN, UserRole.CONTINENTAL_ADMIN, UserRole.DATA_STEWARD);

  app.post<{ Body: { type: string; csvContent: string; reason?: string } }>('/api/v1/master-data/import/csv', {
    preHandler: [...authAndTenant, importRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.importExportService.importCsv(request.body, user);
  });

  app.get<{ Querystring: { type: string } }>('/api/v1/master-data/export/csv', {
    preHandler: authAndTenant,
  }, async (request, reply) => {
    const csv = await app.importExportService.exportCsv(request.query.type);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=${request.query.type}.csv`);
    return csv;
  });

  app.post<{ Body: { csvContent: string; reason?: string } }>('/api/v1/master-data/import/faostat', {
    preHandler: [...authAndTenant, importRoles],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return app.importExportService.importFaostat(request.body, user);
  });
}
