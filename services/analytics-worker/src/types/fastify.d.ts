import type { authHook } from '@aris/auth-middleware';
import type { AnalyticsWorkerService } from '../services/analytics-worker.service';

declare module 'fastify' {
  interface FastifyInstance {
    analyticsService: AnalyticsWorkerService;
    authHookFn: ReturnType<typeof authHook>;
  }
}
