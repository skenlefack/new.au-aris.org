import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rolesHook } from '@aris/auth-middleware';
import { UserRole } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { searchSchema, listIndicesSchema, reindexSchema, exportSchema } from '../schemas/datalake.schema';
import type { SearchDto, ExportDto } from '../services/datalake.service';

export async function registerDatalakeRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/datalake/search — auth required
  app.post('/api/v1/datalake/search', {
    schema: searchSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await app.datalakeService.search(request.body as SearchDto);
    return reply.code(200).send(result);
  });

  // GET /api/v1/datalake/indices — auth + admin roles
  app.get('/api/v1/datalake/indices', {
    schema: listIndicesSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
      ),
    ],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await app.datalakeService.listIndices();
    return reply.code(200).send(result);
  });

  // POST /api/v1/datalake/index/:name/reindex — auth + admin roles
  app.post('/api/v1/datalake/index/:name/reindex', {
    schema: reindexSchema,
    preHandler: [
      app.authHookFn,
      rolesHook(
        UserRole.SUPER_ADMIN,
        UserRole.CONTINENTAL_ADMIN,
      ),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { name } = request.params as { name: string };
    const result = await app.datalakeService.reindex(name, user.tenantId, user.userId);
    return reply.code(202).send(result);
  });

  // GET /api/v1/datalake/export — auth required, returns data
  app.get('/api/v1/datalake/export', {
    schema: exportSchema,
    preHandler: [app.authHookFn],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await app.datalakeService.exportData(request.query as ExportDto);
    return reply.code(200).send(result);
  });
}
