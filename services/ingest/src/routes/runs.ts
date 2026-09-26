import type { FastifyInstance } from 'fastify';
import { tenantHook } from '@aris/auth-middleware/fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerRunRoutes(app: FastifyInstance): Promise<void> {
  const auth = app.authHookFn;
  const tenant = tenantHook();

  // GET /api/v1/ingest/runs/:id — Run execution detail
  app.get('/api/v1/ingest/runs/:id', {
    preHandler: [auth, tenant],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const run = await (app.prisma as any).ingestRun.findUnique({
      where: { id },
      include: {
        rowOutcomes: { orderBy: { rowIndex: 'asc' }, take: 100 },
      },
    });
    if (!run) {
      return { statusCode: 404, message: `Run ${id} not found` };
    }
    return { data: run };
  });
}
