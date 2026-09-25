import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '@aris/auth-middleware/fastify';
import { hasAccessToDomain } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';

export async function registerDomainSummaryRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = '/api/v1/analytics/domains';

  app.get(`${PREFIX}/:code/summary`, {
    preHandler: [app.authHookFn, tenantHook()],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { code } = request.params as { code: string };
    const user = (request as any).user as AuthenticatedUser | undefined;

    // Enforce domain access — admins bypass
    if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'CONTINENTAL_ADMIN') {
      if (!hasAccessToDomain(user, code)) {
        return reply.code(404).send({ statusCode: 404, message: 'Domain not found' });
      }
    }

    const data = await app.domainSummaryService.getSummary(code, user?.tenantId);
    return reply.code(200).send({ data });
  });
}
