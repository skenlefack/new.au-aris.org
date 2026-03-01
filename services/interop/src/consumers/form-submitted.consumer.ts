import type { FastifyInstance } from 'fastify';
import type { AdapterConfig } from '../adapters/base.adapter.js';
import { getAdapter } from '../adapters/index.js';

/**
 * Kafka consumer: listens to `ms.collecte.form.submitted.v1`.
 * When a form is submitted, checks if an active DHIS2 outbound connection exists
 * for the tenant and auto-pushes the data.
 */
export function handleFormSubmitted(app: FastifyInstance) {
  return async (payload: Record<string, unknown>, _key: string, _headers: Record<string, unknown>) => {
    const tenantId = payload['tenantId'] as string;
    if (!tenantId) return;

    try {
      // Check for active DHIS2 connection for this tenant
      const connection = await (app.prisma as any).interopConnection.findFirst({
        where: {
          tenant_id: tenantId,
          system: 'DHIS2',
          is_active: true,
        },
        include: { mappings: { where: { is_active: true, direction: { in: ['OUTBOUND', 'BIDIRECTIONAL'] } } } },
      });

      if (!connection || connection.mappings.length === 0) return;

      const adapter = getAdapter('DHIS2');
      if (!adapter) return;

      const adapterConfig: AdapterConfig = {
        baseUrl: connection.base_url,
        authType: connection.auth_type,
        credentials: connection.credentials as Record<string, unknown>,
        config: connection.config as Record<string, unknown>,
      };

      // Transform and push
      const mappings = connection.mappings.map((m: any) => ({
        sourceField: m.source_field,
        targetField: m.target_field,
        transformation: m.transformation,
      }));

      const transformed = await app.transformEngine.applyMappings(payload, mappings);
      await adapter.push([transformed], adapterConfig);

      // Create transaction record
      await app.transactionService.create({
        connectionId: connection.id,
        direction: 'OUTBOUND',
        entityType: 'form-submission',
        sourcePayload: payload,
        targetPayload: transformed,
        status: 'COMPLETED',
        tenantId,
      });

      app.log.info({ tenantId, system: 'DHIS2' }, 'Auto-synced form submission to DHIS2');
    } catch (err) {
      app.log.error(err, 'Failed to auto-sync form submission to DHIS2');
    }
  };
}
