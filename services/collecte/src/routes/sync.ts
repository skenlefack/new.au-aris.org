import type { FastifyInstance } from 'fastify';
import { tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { SyncService } from '../services/sync.service';
import { SyncRequestSchema, DeltaQuerySchema, StatusQuerySchema } from '../schemas/sync.schema';
import type { SyncRequestBody, DeltaQueryParams, StatusQueryParams } from '../schemas/sync.schema';

export default async function syncRoutes(app: FastifyInstance): Promise<void> {
  const service = new SyncService(app.prisma, app.kafka.producer);

  const auth = app.authHookFn;
  const tenant = tenantHook();

  // POST /api/v1/collecte/sync
  app.post<{ Body: SyncRequestBody }>('/api/v1/collecte/sync', {
    schema: { body: SyncRequestSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return service.deltaSync(request.body, user);
  });

  // GET /api/v1/collecte/sync/delta?since=ISO_DATE&types[]=campaigns
  app.get<{ Querystring: DeltaQueryParams }>('/api/v1/collecte/sync/delta', {
    schema: { querystring: DeltaQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { since, types } = request.query;
    return service.getDelta(user.tenantId, user.userId, since, types as any);
  });

  // GET /api/v1/collecte/sync/status?deviceId=optional
  app.get<{ Querystring: StatusQueryParams }>('/api/v1/collecte/sync/status', {
    schema: { querystring: StatusQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    const { deviceId } = request.query;
    return service.getStatus(user.tenantId, user.userId, deviceId);
  });
}
