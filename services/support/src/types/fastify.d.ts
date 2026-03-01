import type { authHook } from '@aris/auth-middleware';
import type { SupportService } from '../services/support.service';

declare module 'fastify' {
  interface FastifyInstance {
    supportService: SupportService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
