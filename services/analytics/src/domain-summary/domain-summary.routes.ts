import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '@aris/auth-middleware/fastify';

export async function registerDomainSummaryRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics/domains';

  app.get(`${PREFIX}/:code/summary`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { code } = request.params as { code: string };
    const user = (request as any).user;
    const data = await app.domainSummaryService.getSummary(code, user?.tenantId);
    return reply.code(200).send({ data });
  });
}
