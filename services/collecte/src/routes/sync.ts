import type { FastifyInstance } from 'fastify';
import { authHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { SyncService } from '../services/sync.service';
import { SyncRequestSchema } from '../schemas/sync.schema';
import type { SyncRequestBody } from '../schemas/sync.schema';

export default async function syncRoutes(app: FastifyInstance): Promise<void> {
  const service = new SyncService(app.prisma, app.kafka.producer);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // POST /api/v1/collecte/sync
  app.post<{ Body: SyncRequestBody }>('/api/v1/collecte/sync', {
    schema: { body: SyncRequestSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.deltaSync(request.body, user);
  });
}
