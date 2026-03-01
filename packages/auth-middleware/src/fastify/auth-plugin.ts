import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authHook, type AuthHookOptions } from './auth.hook';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Fastify plugin that registers an `authenticate` decorator on the app instance.
 * Usage: `app.register(fastifyAuth, { publicKey: '...' })`
 * Then use `{ preHandler: [app.authenticate] }` on routes.
 */
export default fp<AuthHookOptions>(
  async (app: FastifyInstance, opts: AuthHookOptions) => {
    const hook = authHook(opts);
    app.decorate('authenticate', hook);
  },
  {
    name: '@aris/fastify-auth',
    fastify: '5.x',
  },
);
