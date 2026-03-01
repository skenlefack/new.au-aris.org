import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyKafka } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import {
  TOPIC_AU_INTEROP_V2_SYNC_COMPLETED,
  TOPIC_AU_INTEROP_V2_SYNC_FAILED,
  TOPIC_AU_INTEROP_V2_TRANSACTION_CREATED,
} from '@aris/shared-types';
import { getAdapter, type AdapterConfig } from '../adapters/index.js';
import { TransactionService } from './transaction.service.js';
import { TransformEngine } from './transform.engine.js';

const SERVICE_NAME = 'interop-v2';

export class SyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: FastifyKafka,
    private readonly transactionService: TransactionService,
    private readonly transformEngine: TransformEngine,
  ) {}

  async executeSync(connectionId: string, tenantId: string, userId: string) {
    const conn = await (this.prisma as any).interopConnection.findUnique({
      where: { id: connectionId },
      include: { mappings: { where: { is_active: true } } },
    });
    if (!conn) throw new Error(`Connection ${connectionId} not found`);

    const adapter = getAdapter(conn.system);
    if (!adapter) throw new Error(`No adapter for system: ${conn.system}`);

    const adapterConfig: AdapterConfig = {
      baseUrl: conn.base_url,
      authType: conn.auth_type,
      credentials: conn.credentials as Record<string, unknown>,
      config: conn.config as Record<string, unknown>,
    };

    // Group mappings by direction
    const inboundMappings = conn.mappings.filter(
      (m: any) => m.direction === 'INBOUND' || m.direction === 'BIDIRECTIONAL',
    );
    const outboundMappings = conn.mappings.filter(
      (m: any) => m.direction === 'OUTBOUND' || m.direction === 'BIDIRECTIONAL',
    );

    // Create transaction record
    const tx = await this.transactionService.create({
      connectionId,
      direction: inboundMappings.length > 0 && outboundMappings.length > 0 ? 'BIDIRECTIONAL' : inboundMappings.length > 0 ? 'INBOUND' : 'OUTBOUND',
      entityType: conn.mappings[0]?.entity_type ?? 'unknown',
      sourcePayload: { connectionId, system: conn.system },
      tenantId,
    });

    await this.transactionService.updateStatus(tx.id, 'PROCESSING');

    try {
      // Publish transaction created event
      this.publishEvent(TOPIC_AU_INTEROP_V2_TRANSACTION_CREATED, tx.id, tx, tenantId, userId);

      let totalPulled = 0;
      let totalPushed = 0;

      // Inbound: pull from external system
      if (inboundMappings.length > 0) {
        const entityTypes = [...new Set(inboundMappings.map((m: any) => m.entity_type))];
        for (const entityType of entityTypes) {
          const pullResult = await adapter.pull({ entityType }, adapterConfig);
          totalPulled += pullResult.total;

          // Apply transformations
          const mappingsForType = inboundMappings
            .filter((m: any) => m.entity_type === entityType)
            .map((m: any) => ({
              sourceField: m.source_field,
              targetField: m.target_field,
              transformation: m.transformation,
            }));

          for (const record of pullResult.records) {
            await this.transformEngine.applyMappings(record, mappingsForType);
          }
        }
      }

      // Outbound: push to external system
      if (outboundMappings.length > 0) {
        // In a full implementation, we'd query local data and push
        // For now, push is triggered with explicit data via adapter.push()
        totalPushed = 0; // Would be populated by actual push
      }

      // Update connection lastSyncAt
      await (this.prisma as any).interopConnection.update({
        where: { id: connectionId },
        data: { last_sync_at: new Date() },
      });

      // Update transaction
      await this.transactionService.updateStatus(tx.id, 'COMPLETED');
      await (this.prisma as any).interopTransaction.update({
        where: { id: tx.id },
        data: {
          target_payload: { pulled: totalPulled, pushed: totalPushed },
        },
      });

      this.publishEvent(TOPIC_AU_INTEROP_V2_SYNC_COMPLETED, tx.id, {
        connectionId,
        system: conn.system,
        pulled: totalPulled,
        pushed: totalPushed,
      }, tenantId, userId);

      return { transactionId: tx.id, pulled: totalPulled, pushed: totalPushed, status: 'COMPLETED' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.transactionService.updateStatus(tx.id, 'FAILED', errorMsg);

      this.publishEvent(TOPIC_AU_INTEROP_V2_SYNC_FAILED, tx.id, {
        connectionId,
        system: conn.system,
        error: errorMsg,
      }, tenantId, userId);

      throw err;
    }
  }

  private publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId: string): void {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    this.kafka.send(topic, entityId, payload, headers).catch(() => {
      // Kafka failures are non-blocking
    });
  }
}
