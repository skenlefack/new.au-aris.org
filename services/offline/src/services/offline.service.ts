/**
 * Offline Sync Service — Session-based delta synchronization.
 *
 * Flow: init session → push deltas → pull deltas → complete session
 *
 * Uses Prisma-backed SyncSession / SyncDelta models instead of Redis vector clocks.
 * Delegates conflict detection to DeltaEngine.
 */

import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TOPIC_SYS_OFFLINE_SYNC_INITIATED,
  TOPIC_SYS_OFFLINE_SYNC_PUSHED,
  TOPIC_SYS_OFFLINE_SYNC_CONFLICT,
  TOPIC_SYS_OFFLINE_SYNC_RESOLVED,
  TOPIC_SYS_OFFLINE_SYNC_COMPLETED,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import { DeltaEngine } from './delta-engine';
import type { ApplyResult } from './delta-engine';
import { DeviceService } from './device.service';

const SERVICE_NAME = 'offline-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface SessionInfo {
  id: string;
  deviceId: string;
  userId: string;
  tenantId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  deltasSent: number;
  deltasReceived: number;
  conflictsResolved: number;
  errorMessage: string | null;
}

export class OfflineService {
  private readonly deltaEngine: DeltaEngine;
  private readonly deviceService: DeviceService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {
    this.deltaEngine = new DeltaEngine(prisma, redis);
    this.deviceService = new DeviceService(prisma);
  }

  // ── Session Management ──

  /**
   * Initialize a new sync session for a device.
   */
  async initSession(
    dto: { deviceId: string; metadata?: Record<string, unknown> },
    userId: string,
    tenantId: string,
  ): Promise<SessionInfo> {
    // Check for an existing IN_PROGRESS session for this device
    const existing = await (this.prisma as any).syncSession.findFirst({
      where: {
        device_id: dto.deviceId,
        tenant_id: tenantId,
        status: 'IN_PROGRESS',
      },
    });

    if (existing) {
      throw new HttpError(409, `Device ${dto.deviceId} already has an active sync session: ${existing.id}`);
    }

    const session = await (this.prisma as any).syncSession.create({
      data: {
        device_id: dto.deviceId,
        user_id: userId,
        tenant_id: tenantId,
        status: 'IN_PROGRESS',
        metadata: dto.metadata ? (dto.metadata as any) : undefined,
      },
    });

    await this.publishEvent(
      TOPIC_SYS_OFFLINE_SYNC_INITIATED,
      session.id,
      {
        sessionId: session.id,
        deviceId: dto.deviceId,
        tenantId,
      },
      tenantId,
      userId,
    );

    return this.toSessionInfo(session);
  }

  /**
   * Push deltas from the device to the server within a session.
   */
  async pushDeltas(
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
    userId: string,
    tenantId: string,
  ): Promise<ApplyResult> {
    const session = await this.getSessionOrThrow(sessionId, tenantId);

    if (session.status !== 'IN_PROGRESS') {
      throw new HttpError(400, `Session ${sessionId} is not in progress (status: ${session.status})`);
    }

    // Process batch through delta engine
    const result = await this.deltaEngine.processBatch(sessionId, deltas, tenantId);

    // Update session counters
    await (this.prisma as any).syncSession.update({
      where: { id: sessionId },
      data: {
        deltas_received: { increment: result.applied.length },
      },
    });

    // Publish events
    await this.publishEvent(
      TOPIC_SYS_OFFLINE_SYNC_PUSHED,
      sessionId,
      {
        sessionId,
        deviceId: session.device_id,
        appliedCount: result.applied.length,
        conflictCount: result.conflicts.length,
        duplicateCount: result.duplicates.length,
        tenantId,
      },
      tenantId,
      userId,
    );

    // Publish individual conflict events
    for (const conflict of result.conflicts.filter((c) => !c.autoResolved)) {
      await this.publishEvent(
        TOPIC_SYS_OFFLINE_SYNC_CONFLICT,
        conflict.deltaId,
        {
          sessionId,
          deltaId: conflict.deltaId,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          clientVersion: conflict.clientVersion,
          serverVersion: conflict.serverVersion,
          tenantId,
        },
        tenantId,
        userId,
      );
    }

    return result;
  }

  /**
   * Pull deltas from the server for the device within a session.
   */
  async pullDeltas(
    sessionId: string,
    dto: { since?: string; entityTypes?: string[]; limit?: number },
    userId: string,
    tenantId: string,
  ): Promise<{ data: any[]; checkpoint: string; hasMore: boolean }> {
    const session = await this.getSessionOrThrow(sessionId, tenantId);

    if (session.status !== 'IN_PROGRESS') {
      throw new HttpError(400, `Session ${sessionId} is not in progress (status: ${session.status})`);
    }

    const limit = dto.limit ?? 500;
    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      conflict_status: { in: ['NONE', 'AUTO_RESOLVED'] },
    };

    if (dto.since) {
      where['server_timestamp'] = { gt: new Date(dto.since) };
    }

    if (dto.entityTypes && dto.entityTypes.length > 0) {
      where['entity_type'] = { in: dto.entityTypes };
    }

    // Exclude deltas from the current session (device's own changes)
    where['session_id'] = { not: sessionId };

    const deltas = await (this.prisma as any).syncDelta.findMany({
      where,
      orderBy: { server_timestamp: 'asc' },
      take: limit + 1, // fetch 1 extra to check hasMore
    });

    const hasMore = deltas.length > limit;
    const resultDeltas = hasMore ? deltas.slice(0, limit) : deltas;

    // Update session counter
    await (this.prisma as any).syncSession.update({
      where: { id: sessionId },
      data: {
        deltas_sent: { increment: resultDeltas.length },
      },
    });

    const checkpoint = resultDeltas.length > 0
      ? resultDeltas[resultDeltas.length - 1].server_timestamp.toISOString()
      : new Date().toISOString();

    return {
      data: resultDeltas.map((d: any) => ({
        id: d.id,
        entityType: d.entity_type,
        entityId: d.entity_id,
        operation: d.operation,
        payload: d.resolved_payload ?? d.payload,
        version: d.version,
        serverTimestamp: d.server_timestamp.toISOString(),
      })),
      checkpoint,
      hasMore,
    };
  }

  /**
   * Complete a sync session.
   */
  async completeSession(
    sessionId: string,
    dto: { status?: 'COMPLETED' | 'FAILED' | 'PARTIAL'; errorMessage?: string },
    userId: string,
    tenantId: string,
  ): Promise<SessionInfo> {
    const session = await this.getSessionOrThrow(sessionId, tenantId);

    if (session.status !== 'IN_PROGRESS') {
      throw new HttpError(400, `Session ${sessionId} is not in progress (status: ${session.status})`);
    }

    const finalStatus = dto.status ?? 'COMPLETED';

    const updated = await (this.prisma as any).syncSession.update({
      where: { id: sessionId },
      data: {
        status: finalStatus,
        completed_at: new Date(),
        error_message: dto.errorMessage ?? null,
      },
    });

    // Update device's last sync timestamp
    await this.deviceService.updateLastSync(session.device_id, {
      sessionId,
      completedAt: new Date().toISOString(),
      deltasSent: updated.deltas_sent,
      deltasReceived: updated.deltas_received,
    });

    await this.publishEvent(
      TOPIC_SYS_OFFLINE_SYNC_COMPLETED,
      sessionId,
      {
        sessionId,
        deviceId: session.device_id,
        status: finalStatus,
        deltasSent: updated.deltas_sent,
        deltasReceived: updated.deltas_received,
        conflictsResolved: updated.conflicts_resolved,
        tenantId,
      },
      tenantId,
      userId,
    );

    return this.toSessionInfo(updated);
  }

  /**
   * Get session info by ID.
   */
  async getSession(
    sessionId: string,
    tenantId: string,
  ): Promise<SessionInfo> {
    const session = await this.getSessionOrThrow(sessionId, tenantId);
    return this.toSessionInfo(session);
  }

  // ── Conflict Management ──

  /**
   * Resolve a conflict on a specific delta.
   */
  async resolveConflict(
    deltaId: string,
    resolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE',
    tenantId: string,
    userId: string,
    mergedPayload?: Record<string, unknown>,
  ): Promise<{ entityType: string; entityId: string }> {
    const result = await this.deltaEngine.resolveConflict(
      deltaId,
      resolution,
      tenantId,
      mergedPayload,
    );

    await this.publishEvent(
      TOPIC_SYS_OFFLINE_SYNC_RESOLVED,
      deltaId,
      {
        deltaId,
        resolution,
        entityType: result.entityType,
        entityId: result.entityId,
        tenantId,
      },
      tenantId,
      userId,
    );

    return result;
  }

  /**
   * List pending conflicts for a tenant.
   */
  async listConflicts(
    tenantId: string,
    query: { sessionId?: string; entityType?: string; page?: number; limit?: number },
  ): Promise<{ data: any[]; meta: { total: number; page: number; limit: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      conflict_status: 'MANUAL_REQUIRED',
    };

    if (query.sessionId) {
      where['session_id'] = query.sessionId;
    }

    if (query.entityType) {
      where['entity_type'] = query.entityType;
    }

    const [deltas, total] = await Promise.all([
      (this.prisma as any).syncDelta.findMany({
        where,
        orderBy: { server_timestamp: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).syncDelta.count({ where }),
    ]);

    return {
      data: deltas.map((d: any) => ({
        id: d.id,
        sessionId: d.session_id,
        entityType: d.entity_type,
        entityId: d.entity_id,
        operation: d.operation,
        payload: d.payload,
        version: d.version,
        clientTimestamp: d.client_timestamp.toISOString(),
        serverTimestamp: d.server_timestamp.toISOString(),
        conflictStatus: d.conflict_status,
      })),
      meta: { total, page, limit },
    };
  }

  // ── Device delegation ──

  get devices(): DeviceService {
    return this.deviceService;
  }

  // ── Private helpers ──

  private async getSessionOrThrow(sessionId: string, tenantId: string): Promise<any> {
    const session = await (this.prisma as any).syncSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new HttpError(404, `Session ${sessionId} not found`);
    }

    if (session.tenant_id !== tenantId) {
      throw new HttpError(403, 'Session belongs to a different tenant');
    }

    return session;
  }

  private toSessionInfo(session: any): SessionInfo {
    return {
      id: session.id,
      deviceId: session.device_id,
      userId: session.user_id,
      tenantId: session.tenant_id,
      status: session.status,
      startedAt: session.started_at.toISOString(),
      completedAt: session.completed_at ? session.completed_at.toISOString() : null,
      deltasSent: session.deltas_sent,
      deltasReceived: session.deltas_received,
      conflictsResolved: session.conflicts_resolved,
      errorMessage: session.error_message,
    };
  }

  private async publishEvent(
    topic: string,
    entityId: string,
    payload: unknown,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.kafka.send(topic, entityId, payload, headers);
    } catch {
      // Kafka unavailable — silently skip
    }
  }
}
