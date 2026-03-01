import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { MfaCodeSchema, type MfaCodeInput } from '../schemas/mfa.schemas.js';

export async function registerMfaRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/mfa/setup
  app.post('/api/v1/auth/mfa/setup', {
    preHandler: [app.authHookFn],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.mfaService.setup(user.userId);
    return { data: result };
  });

  // POST /api/v1/auth/mfa/verify
  app.post<{ Body: MfaCodeInput }>('/api/v1/auth/mfa/verify', {
    schema: { body: MfaCodeSchema },
    preHandler: [app.authHookFn],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.mfaService.verify(user.userId, request.body.code);
    return reply.code(200).send({ data: result });
  });

  // POST /api/v1/auth/mfa/disable
  app.post<{ Body: MfaCodeInput }>('/api/v1/auth/mfa/disable', {
    schema: { body: MfaCodeSchema },
    preHandler: [app.authHookFn],
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const result = await app.mfaService.disable(user.userId, request.body.code);
    return reply.code(200).send({ data: result });
  });
}
