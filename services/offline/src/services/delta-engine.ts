/**
 * Delta Engine — Conflict detection and resolution for offline sync.
 *
 * Handles:
 * - Version-based conflict detection (client version vs server version)
 * - LWW (Last-Write-Wins) auto-resolution for non-critical fields
 * - Manual resolution flagging for critical entity types
 * - Deduplication by client-side delta ID (idempotence)
 */

import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';

// Entity types that require manual conflict resolution instead of LWW
const CRITICAL_ENTITY_TYPES = new Set([
  'health_event',
  'outbreak',
  'sps_certificate',
  'vaccination_campaign',
  'wahis_notification',
  'lab_result',
]);

// Redis key patterns
const KEY_ENTITY_VERSION = (tenantId: string, entityType: string, entityId: string) =>
  `aris:offline:version:${tenantId}:${entityType}:${entityId}`;

const KEY_PROCESSED_DELTA = (deltaId: string) =>
  `aris:offline:processed:${deltaId}`;

export interface ConflictResult {
  deltaId: string;
  entityType: string;
  entityId: string;
  clientVersion: number;
  serverVersion: number;
  conflictingFields: string[];
  autoResolved: boolean;
  resolvedPayload?: Record<string, unknown>;
}

export interface ApplyResult {
  applied: string[];
  conflicts: ConflictResult[];
  duplicates: string[];
}

export class DeltaEngine {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  /**
   * Process a batch of deltas within a sync session.
   * Returns applied delta IDs, detected conflicts, and skipped duplicates.
   */
  async processBatch(
    sessionId: string,
    deltas: Array<{
      id: string;
      entityType: string;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      payload: Record<string, unknown>;
      version: number;
      clientTimestamp: string;
    }>,
    tenantId: string,
  ): Promise<ApplyResult> {
    const applied: string[] = [];
    const conflicts: ConflictResult[] = [];
    const duplicates: string[] = [];

    for (const delta of deltas) {
      // 1. Idempotence check — skip already-processed deltas
      const alreadyProcessed = await this.redis.get(KEY_PROCESSED_DELTA(delta.id));
      if (alreadyProcessed) {
        duplicates.push(delta.id);
        continue;
      }

      // 2. Get current server version
      const serverVersionStr = await this.redis.get(
        KEY_ENTITY_VERSION(tenantId, delta.entityType, delta.entityId),
      );
      const serverVersion = serverVersionStr ? parseInt(serverVersionStr, 10) : 0;

      // 3. CREATE with no existing version — always apply
      if (delta.operation === 'CREATE' && serverVersion === 0) {
        await this.applyDelta(sessionId, delta, tenantId, 1);
        applied.push(delta.id);
        continue;
      }

      // 4. Version comparison — detect conflicts
      if (delta.version < serverVersion) {
        const conflict = await this.handleConflict(
          sessionId,
          delta,
          serverVersion,
          tenantId,
        );
        if (conflict.autoResolved) {
          applied.push(delta.id);
        }
        conflicts.push(conflict);
        continue;
      }

      // 5. No conflict — apply delta
      const newVersion = serverVersion + 1;
      await this.applyDelta(sessionId, delta, tenantId, newVersion);
      applied.push(delta.id);
    }

    return { applied, conflicts, duplicates };
  }

  /**
   * Handle a detected conflict. Uses LWW for non-critical entities,
   * flags MANUAL_REQUIRED for critical entity types.
   */
  private async handleConflict(
    sessionId: string,
    delta: {
      id: string;
      entityType: string;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      payload: Record<string, unknown>;
      version: number;
      clientTimestamp: string;
    },
    serverVersion: number,
    tenantId: string,
  ): Promise<ConflictResult> {
    // Get existing server data to identify conflicting fields
    const serverData = await this.getServerPayload(tenantId, delta.entityType, delta.entityId);
    const conflictingFields = this.detectConflictingFields(serverData, delta.payload);

    const isCritical = CRITICAL_ENTITY_TYPES.has(delta.entityType);

    if (!isCritical && delta.operation !== 'DELETE') {
      // LWW auto-resolution: client timestamp wins
      const resolvedPayload = { ...serverData, ...delta.payload };
      const newVersion = serverVersion + 1;

      await this.writeDelta(sessionId, delta, tenantId, newVersion, 'AUTO_RESOLVED', resolvedPayload);

      // Mark as processed for idempotence
      await this.redis.set(KEY_PROCESSED_DELTA(delta.id), '1', 'EX', 7 * 24 * 3600);

      // Update version
      await this.redis.set(
        KEY_ENTITY_VERSION(tenantId, delta.entityType, delta.entityId),
        String(newVersion),
      );

      return {
        deltaId: delta.id,
        entityType: delta.entityType,
        entityId: delta.entityId,
        clientVersion: delta.version,
        serverVersion,
        conflictingFields,
        autoResolved: true,
        resolvedPayload,
      };
    }

    // Critical entity or DELETE — require manual resolution
    await this.writeDelta(sessionId, delta, tenantId, serverVersion, 'MANUAL_REQUIRED', undefined);

    // Mark as processed for idempotence
    await this.redis.set(KEY_PROCESSED_DELTA(delta.id), '1', 'EX', 7 * 24 * 3600);

    return {
      deltaId: delta.id,
      entityType: delta.entityType,
      entityId: delta.entityId,
      clientVersion: delta.version,
      serverVersion,
      conflictingFields,
      autoResolved: false,
    };
  }

  /**
   * Apply a non-conflicting delta: write to DB + update version in Redis.
   */
  private async applyDelta(
    sessionId: string,
    delta: {
      id: string;
      entityType: string;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      payload: Record<string, unknown>;
      version: number;
      clientTimestamp: string;
    },
    tenantId: string,
    newVersion: number,
  ): Promise<void> {
    await this.writeDelta(sessionId, delta, tenantId, newVersion, 'NONE', undefined);

    // Mark as processed for idempotence (7 days TTL)
    await this.redis.set(KEY_PROCESSED_DELTA(delta.id), '1', 'EX', 7 * 24 * 3600);

    // Update version in Redis
    await this.redis.set(
      KEY_ENTITY_VERSION(tenantId, delta.entityType, delta.entityId),
      String(newVersion),
    );
  }

  /**
   * Write a SyncDelta record to the database.
   */
  private async writeDelta(
    sessionId: string,
    delta: {
      id: string;
      entityType: string;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      payload: Record<string, unknown>;
      version: number;
      clientTimestamp: string;
    },
    tenantId: string,
    version: number,
    conflictStatus: 'NONE' | 'DETECTED' | 'AUTO_RESOLVED' | 'MANUAL_REQUIRED',
    resolvedPayload: Record<string, unknown> | undefined,
  ): Promise<void> {
    await (this.prisma as any).syncDelta.create({
      data: {
        id: delta.id,
        session_id: sessionId,
        entity_type: delta.entityType,
        entity_id: delta.entityId,
        operation: delta.operation,
        payload: delta.payload as any,
        version,
        client_timestamp: new Date(delta.clientTimestamp),
        conflict_status: conflictStatus,
        resolved_payload: resolvedPayload ? (resolvedPayload as any) : undefined,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Resolve a conflict manually (called from the resolve endpoint).
   */
  async resolveConflict(
    deltaId: string,
    resolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE',
    tenantId: string,
    mergedPayload?: Record<string, unknown>,
  ): Promise<{ entityType: string; entityId: string }> {
    const delta = await (this.prisma as any).syncDelta.findUnique({
      where: { id: deltaId },
    });

    if (!delta) {
      throw new HttpError(404, `Delta ${deltaId} not found`);
    }

    if (delta.tenant_id !== tenantId) {
      throw new HttpError(403, 'Delta belongs to a different tenant');
    }

    if (delta.conflict_status !== 'MANUAL_REQUIRED' && delta.conflict_status !== 'DETECTED') {
      throw new HttpError(400, 'Delta does not have a pending conflict');
    }

    let resolvedData: Record<string, unknown>;

    switch (resolution) {
      case 'CLIENT_WINS':
        resolvedData = delta.payload as Record<string, unknown>;
        break;
      case 'SERVER_WINS': {
        const serverData = await this.getServerPayload(tenantId, delta.entity_type, delta.entity_id);
        resolvedData = serverData;
        break;
      }
      case 'MERGE':
        if (!mergedPayload) {
          throw new HttpError(400, 'mergedPayload is required for MERGE resolution');
        }
        resolvedData = mergedPayload;
        break;
    }

    // Update the delta record
    await (this.prisma as any).syncDelta.update({
      where: { id: deltaId },
      data: {
        conflict_status: 'AUTO_RESOLVED', // reuse enum — resolved
        resolved_payload: resolvedData as any,
      },
    });

    // Bump version
    const versionKey = KEY_ENTITY_VERSION(tenantId, delta.entity_type, delta.entity_id);
    const currentVersion = await this.redis.get(versionKey);
    const newVersion = (currentVersion ? parseInt(currentVersion, 10) : 0) + 1;
    await this.redis.set(versionKey, String(newVersion));

    // Update session conflict count
    await (this.prisma as any).syncSession.update({
      where: { id: delta.session_id },
      data: { conflicts_resolved: { increment: 1 } },
    });

    return { entityType: delta.entity_type, entityId: delta.entity_id };
  }

  /**
   * Get server-side payload for an entity (most recent delta).
   */
  private async getServerPayload(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const latest = await (this.prisma as any).syncDelta.findFirst({
      where: {
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        conflict_status: { in: ['NONE', 'AUTO_RESOLVED'] },
      },
      orderBy: { server_timestamp: 'desc' },
    });

    if (!latest) return {};

    return (latest.resolved_payload ?? latest.payload) as Record<string, unknown>;
  }

  /**
   * Detect which fields differ between server and client payloads.
   */
  detectConflictingFields(
    server: Record<string, unknown>,
    client: Record<string, unknown>,
  ): string[] {
    const allKeys = new Set([...Object.keys(server), ...Object.keys(client)]);
    const conflicts: string[] = [];

    for (const key of allKeys) {
      if (JSON.stringify(server[key]) !== JSON.stringify(client[key])) {
        conflicts.push(key);
      }
    }

    return conflicts;
  }
}

// ── HttpError ──
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
