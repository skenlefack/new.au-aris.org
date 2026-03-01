import type { authHook } from '@aris/auth-middleware';
import type { OfflineService } from '../services/offline.service';

declare module 'fastify' {
  interface FastifyInstance {
    offlineService: OfflineService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
