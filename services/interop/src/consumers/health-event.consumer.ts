import type { FastifyInstance } from 'fastify';
import type { AdapterConfig } from '../adapters/base.adapter.js';
import { getAdapter } from '../adapters/index.js';

/**
 * Kafka consumer: listens to `ms.health.event.created`.
 * When a health event is created, checks for active WAHIS/EMPRES connections
 * and auto-pushes confirmed events.
 */
export function handleHealthEvent(app: FastifyInstance) {
  return async (payload: Record<string, unknown>, _key: string, _headers: Record<string, unknown>) => {
    const tenantId = payload['tenantId'] as string;
    if (!tenantId) return;

    const systems = ['WAHIS', 'EMPRES'] as const;

    for (const system of systems) {
      try {
        const connection = await (app.prisma as any).interopConnection.findFirst({
          where: {
            tenant_id: tenantId,
            system,
            is_active: true,
          },
        });

        if (!connection) continue;

        const adapter = getAdapter(system);
        if (!adapter) continue;

        const adapterConfig: AdapterConfig = {
          baseUrl: connection.base_url,
          authType: connection.auth_type,
          credentials: connection.credentials as Record<string, unknown>,
          config: connection.config as Record<string, unknown>,
        };

        const externalPayload = adapter.mapToExternal(payload, 'outbreak');
        const result = await adapter.push([externalPayload], adapterConfig);

        await app.transactionService.create({
          connectionId: connection.id,
          direction: 'OUTBOUND',
          entityType: 'health-event',
          sourcePayload: payload,
          targetPayload: externalPayload,
          status: result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          tenantId,
        });

        app.log.info({ tenantId, system }, `Auto-pushed health event to ${system}`);
      } catch (err) {
        app.log.error(err, `Failed to auto-push health event to ${system}`);
      }
    }
  };
}
