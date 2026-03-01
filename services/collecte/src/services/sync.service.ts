import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TOPIC_MS_COLLECTE_FORM_SYNCED,
  TOPIC_MS_COLLECTE_FORM_SUBMITTED,
  DataClassification,
} from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const SERVICE_NAME = 'collecte-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface SubmissionPayload {
  id?: string;
  campaignId: string;
  data: Record<string, unknown>;
  deviceId?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  offlineCreatedAt?: string;
  dataClassification?: string;
  version?: number;
}

export interface SyncRejection {
  id: string;
  errors: { field: string; message: string }[];
}

export interface ConflictInfo {
  submissionId: string;
  clientVersion: number;
  serverVersion: number;
  strategy: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
  resolvedBy: 'client' | 'server' | 'pending';
}

export interface CampaignUpdate {
  id: string;
  status: string;
  name: string;
  startDate: Date;
  endDate: Date;
  updatedAt: Date;
}

export interface SyncResponse {
  accepted: string[];
  rejected: SyncRejection[];
  conflicts: ConflictInfo[];
  serverUpdates: CampaignUpdate[];
  syncedAt: string;
}

export interface SyncRequestDto {
  submissions: SubmissionPayload[];
  lastSyncAt: string;
}

export class SyncService {
  private readonly ajv: Ajv;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async deltaSync(
    dto: SyncRequestDto,
    user: AuthenticatedUser,
  ): Promise<SyncResponse> {
    const startMs = Date.now();
    const syncedAt = new Date();

    const accepted: string[] = [];
    const rejected: SyncRejection[] = [];
    const conflicts: ConflictInfo[] = [];

    // Process each submission
    for (const payload of dto.submissions) {
      try {
        const result = await this.processSubmission(payload, user, syncedAt);
        if (result.status === 'accepted') {
          accepted.push(result.id);
        } else if (result.status === 'rejected') {
          rejected.push({ id: result.id, errors: result.errors });
        } else if (result.status === 'conflict') {
          conflicts.push(result.conflict);
          // If resolved by client (last-write-wins), also accept it
          if (result.conflict.resolvedBy === 'client') {
            accepted.push(result.id);
          }
        }
      } catch (error) {
        const id = payload.id ?? 'unknown';
        console.error(
          `[SyncService] Sync error for submission ${id}`,
          error instanceof Error ? error.stack : String(error),
        );
        rejected.push({
          id,
          errors: [
            {
              field: '_sync',
              message: error instanceof Error ? error.message : 'Internal sync error',
            },
          ],
        });
      }
    }

    // Get server-side campaign updates since lastSyncAt
    const serverUpdates = await this.getServerUpdates(
      user,
      new Date(dto.lastSyncAt),
    );

    // Log sync event
    const durationMs = Date.now() - startMs;
    await this.logSync(user, dto, accepted, rejected, conflicts, durationMs, syncedAt);

    // Publish sync event to Kafka
    await this.publishSyncEvent(user, accepted.length, rejected.length, conflicts.length);

    console.log(
      `[SyncService] Sync completed: ${accepted.length} accepted, ${rejected.length} rejected, ${conflicts.length} conflicts (${durationMs}ms)`,
    );

    return {
      accepted,
      rejected,
      conflicts,
      serverUpdates,
      syncedAt: syncedAt.toISOString(),
    };
  }

  /**
   * Process a single submission from the sync batch.
   * Handles: new submissions, updates with conflict detection.
   */
  private async processSubmission(
    payload: SubmissionPayload,
    user: AuthenticatedUser,
    syncedAt: Date,
  ): Promise<
    | { status: 'accepted'; id: string }
    | { status: 'rejected'; id: string; errors: { field: string; message: string }[] }
    | { status: 'conflict'; id: string; conflict: ConflictInfo }
  > {
    // Load campaign
    const campaign = await (this.prisma as any).campaign.findUnique({
      where: { id: payload.campaignId },
    });

    if (!campaign) {
      return {
        status: 'rejected',
        id: payload.id ?? uuidv4(),
        errors: [{ field: 'campaignId', message: `Campaign ${payload.campaignId} not found` }],
      };
    }

    if (campaign.status !== 'ACTIVE') {
      return {
        status: 'rejected',
        id: payload.id ?? uuidv4(),
        errors: [{ field: 'campaignId', message: `Campaign is not active (${campaign.status})` }],
      };
    }

    // Validate JSON Schema
    const schemaErrors = await this.validateSchema(campaign.templateId, payload.data);
    if (schemaErrors.length > 0) {
      return {
        status: 'rejected',
        id: payload.id ?? uuidv4(),
        errors: schemaErrors,
      };
    }

    // Check if this is an update to an existing submission
    if (payload.id) {
      const existing = await (this.prisma as any).submission.findUnique({
        where: { id: payload.id },
      });

      if (existing) {
        return this.resolveConflict(
          existing,
          payload,
          campaign.conflictStrategy,
          user,
          syncedAt,
        );
      }
    }

    // New submission
    const id = payload.id ?? uuidv4();
    await (this.prisma as any).submission.create({
      data: {
        id,
        tenantId: user.tenantId,
        campaignId: payload.campaignId,
        templateId: campaign.templateId,
        data: payload.data as Prisma.InputJsonValue,
        submittedBy: user.userId,
        submittedAt: syncedAt,
        deviceId: payload.deviceId ?? null,
        gpsLat: payload.gpsLat ?? null,
        gpsLng: payload.gpsLng ?? null,
        gpsAccuracy: payload.gpsAccuracy ?? null,
        offlineCreatedAt: payload.offlineCreatedAt
          ? new Date(payload.offlineCreatedAt)
          : null,
        syncedAt,
        dataClassification:
          payload.dataClassification ?? DataClassification.RESTRICTED,
        status: 'SUBMITTED',
      },
    });

    // Publish submitted event for downstream processing
    await this.publishSubmittedEvent(id, payload, campaign.domain, user);

    return { status: 'accepted', id };
  }

  /**
   * Resolve conflict between client and server versions.
   *
   * LAST_WRITE_WINS: Client version overwrites server if client version >= server version,
   *   or if offlineCreatedAt is more recent. Server wins otherwise.
   *
   * MANUAL_MERGE: Always flag as pending conflict for manual resolution.
   */
  private async resolveConflict(
    existing: {
      id: string;
      version: number;
      updatedAt: Date;
      status: string;
    },
    payload: SubmissionPayload,
    strategy: string,
    user: AuthenticatedUser,
    syncedAt: Date,
  ): Promise<
    | { status: 'accepted'; id: string }
    | { status: 'conflict'; id: string; conflict: ConflictInfo }
  > {
    const clientVersion = payload.version ?? 1;

    if (strategy === 'MANUAL_MERGE') {
      return {
        status: 'conflict',
        id: existing.id,
        conflict: {
          submissionId: existing.id,
          clientVersion,
          serverVersion: existing.version,
          strategy: 'MANUAL_MERGE',
          resolvedBy: 'pending',
        },
      };
    }

    // LAST_WRITE_WINS strategy
    if (clientVersion >= existing.version) {
      // Client wins — overwrite server
      await (this.prisma as any).submission.update({
        where: { id: existing.id },
        data: {
          data: payload.data as Prisma.InputJsonValue,
          deviceId: payload.deviceId ?? undefined,
          gpsLat: payload.gpsLat ?? undefined,
          gpsLng: payload.gpsLng ?? undefined,
          gpsAccuracy: payload.gpsAccuracy ?? undefined,
          offlineCreatedAt: payload.offlineCreatedAt
            ? new Date(payload.offlineCreatedAt)
            : undefined,
          syncedAt,
          version: clientVersion + 1,
          // Only reset to SUBMITTED if not already validated
          ...(existing.status === 'DRAFT' && { status: 'SUBMITTED' }),
        },
      });

      return {
        status: 'conflict',
        id: existing.id,
        conflict: {
          submissionId: existing.id,
          clientVersion,
          serverVersion: existing.version,
          strategy: 'LAST_WRITE_WINS',
          resolvedBy: 'client',
        },
      };
    }

    // Server wins — client has stale data
    return {
      status: 'conflict',
      id: existing.id,
      conflict: {
        submissionId: existing.id,
        clientVersion,
        serverVersion: existing.version,
        strategy: 'LAST_WRITE_WINS',
        resolvedBy: 'server',
      },
    };
  }

  /**
   * Get campaigns that were updated since lastSyncAt.
   * Returns minimal campaign info for the mobile client to refresh.
   */
  private async getServerUpdates(
    user: AuthenticatedUser,
    lastSyncAt: Date,
  ): Promise<CampaignUpdate[]> {
    const campaigns = await (this.prisma as any).campaign.findMany({
      where: {
        tenantId: user.tenantId,
        updatedAt: { gt: lastSyncAt },
      },
      select: {
        id: true,
        status: true,
        name: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return campaigns.map((c: any) => ({
      id: c.id,
      status: c.status,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      updatedAt: c.updatedAt,
    }));
  }

  private async validateSchema(
    templateId: string,
    data: Record<string, unknown>,
  ): Promise<{ field: string; message: string }[]> {
    try {
      const template = await (this.prisma as any).formTemplate.findUnique({
        where: { id: templateId },
        select: { schema: true },
      });

      if (!template) return [];

      const schema = template.schema as Record<string, unknown>;
      const validate = this.ajv.compile(schema);
      const valid = validate(data);

      if (!valid && validate.errors) {
        return validate.errors.map((e) => ({
          field: e.instancePath || '/',
          message: e.message ?? 'Validation error',
        }));
      }
    } catch {
      // Skip validation if template not accessible
    }

    return [];
  }

  private async logSync(
    user: AuthenticatedUser,
    dto: SyncRequestDto,
    accepted: string[],
    rejected: SyncRejection[],
    conflicts: ConflictInfo[],
    durationMs: number,
    syncedAt: Date,
  ): Promise<void> {
    try {
      await (this.prisma as any).syncLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          deviceId: dto.submissions[0]?.deviceId ?? null,
          syncedAt,
          submissionCount: dto.submissions.length,
          acceptedCount: accepted.length,
          rejectedCount: rejected.length,
          conflictCount: conflicts.length,
          durationMs,
        },
      });
    } catch (error) {
      console.error(
        '[SyncService] Failed to log sync event',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async publishSyncEvent(
    user: AuthenticatedUser,
    acceptedCount: number,
    rejectedCount: number,
    conflictCount: number,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const payload = {
      userId: user.userId,
      tenantId: user.tenantId,
      acceptedCount,
      rejectedCount,
      conflictCount,
    };

    try {
      await this.kafkaProducer.send(
        TOPIC_MS_COLLECTE_FORM_SYNCED,
        user.userId,
        payload,
        headers,
      );
    } catch (error) {
      console.error(
        '[SyncService] Failed to publish sync event',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async publishSubmittedEvent(
    submissionId: string,
    payload: SubmissionPayload,
    domain: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const eventPayload = {
      submissionId,
      campaignId: payload.campaignId,
      submittedBy: user.userId,
      domain,
      deviceId: payload.deviceId,
    };

    try {
      await this.kafkaProducer.send(
        TOPIC_MS_COLLECTE_FORM_SUBMITTED,
        submissionId,
        eventPayload,
        headers,
      );
    } catch (error) {
      console.error(
        `[SyncService] Failed to publish submitted event for ${submissionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
