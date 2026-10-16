// ═══════════════════════════════════════════════════════════════════
//  Connection Manager — CRUD + lifecycle + health check
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaEvent } from '@aris/shared-types';
import {
  TOPIC_AU_HUB_CONNECTION_CREATED,
  TOPIC_AU_HUB_CONNECTION_ACTIVATED,
  TOPIC_AU_HUB_CONNECTION_SUSPENDED,
  TOPIC_AU_HUB_CONNECTION_HEALTH_DOWN,
  TOPIC_AU_HUB_CONNECTION_HEALTH_RESTORED,
} from '@aris/shared-types';
import type {
  HubConnection,
  HubConnectionStatus,
  HubHealthStatus,
  CreateConnectionDto,
  UpdateConnectionDto,
  PaginationParams,
  PaginatedResult,
  HubLogger,
} from './types';

const KAFKA_TIMEOUT_MS = 5_000;
const SERVICE_NAME = 'interop-hub';

export class ConnectionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubConnection;
  }

  private get healthDb() {
    return (this.prisma as any).hubHealthCheck;
  }

  /** Publish a Kafka event with a 5 s timeout (project convention). */
  private async publishEvent(topic: string, key: string, payload: Record<string, unknown>, tenantId: string): Promise<void> {
    const event: KafkaEvent<Record<string, unknown>> = {
      id: randomUUID(),
      topic,
      key,
      payload,
      headers: {
        correlationId: randomUUID(),
        sourceService: SERVICE_NAME,
        tenantId,
        schemaVersion: '1',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      version: 1,
    };

    try {
      await Promise.race([
        this.kafka.publish(event),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka publish timeout')), KAFKA_TIMEOUT_MS)),
      ]);
    } catch (err) {
      this.logger.warn(`Kafka publish failed for ${topic}: ${err}`);
    }
  }

  private throwHttp(statusCode: number, message: string): never {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    throw err;
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  async create(dto: CreateConnectionDto): Promise<HubConnection> {
    const existing = await this.db.findFirst({
      where: { tenant_id: dto.tenant_id, name: dto.name },
    });
    if (existing) {
      this.throwHttp(409, `Connection with name "${dto.name}" already exists for this tenant`);
    }

    const connection = await this.db.create({
      data: {
        tenant_id: dto.tenant_id,
        name: dto.name,
        description: dto.description ?? null,
        system_type: dto.system_type,
        system_name: dto.system_name ?? null,
        system_version: dto.system_version ?? null,
        country_code: dto.country_code ?? null,
        country_name: dto.country_name ?? null,
        organization: dto.organization ?? null,
        base_url: dto.base_url ?? null,
        auth_type: dto.auth_type ?? 'NONE',
        credentials: dto.credentials ?? {},
        headers: dto.headers ?? {},
        tls_config: dto.tls_config ?? null,
        direction: dto.direction,
        domains: dto.domains,
        focal_technical: dto.focal_technical ?? null,
        focal_data_owner: dto.focal_data_owner ?? null,
        notes: dto.notes ?? null,
        config: dto.config ?? {},
        created_by: dto.created_by,
      },
    });

    await this.publishEvent(TOPIC_AU_HUB_CONNECTION_CREATED, connection.id, {
      id: connection.id,
      name: connection.name,
      direction: connection.direction,
      system_type: connection.system_type,
    }, dto.tenant_id);

    this.logger.info(`Connection created: ${connection.id} (${connection.name})`);
    return connection as HubConnection;
  }

  async findAll(
    tenantId: string,
    tenantLevel: 'CONTINENTAL' | 'REC' | 'MEMBER_STATE',
    childTenantIds: string[] = [],
    params: PaginationParams = {},
  ): Promise<PaginatedResult<HubConnection>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    // Tenant-aware visibility
    let tenantFilter: Record<string, unknown>;
    if (tenantLevel === 'CONTINENTAL') {
      tenantFilter = {}; // sees all
    } else if (tenantLevel === 'REC') {
      tenantFilter = { tenant_id: { in: [tenantId, ...childTenantIds] } };
    } else {
      tenantFilter = { tenant_id: tenantId };
    }

    const [data, total] = await Promise.all([
      this.db.findMany({
        where: tenantFilter,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where: tenantFilter }),
    ]);

    return {
      data: data as HubConnection[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, tenantId: string): Promise<HubConnection> {
    const connection = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
      include: { pipelines: true, schedules: true },
    });
    if (!connection) {
      this.throwHttp(404, `Connection ${id} not found`);
    }
    return connection as HubConnection;
  }

  async update(id: string, tenantId: string, dto: UpdateConnectionDto): Promise<HubConnection> {
    const existing = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      this.throwHttp(404, `Connection ${id} not found`);
    }

    const connection = await this.db.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.system_type !== undefined && { system_type: dto.system_type }),
        ...(dto.system_name !== undefined && { system_name: dto.system_name }),
        ...(dto.system_version !== undefined && { system_version: dto.system_version }),
        ...(dto.country_code !== undefined && { country_code: dto.country_code }),
        ...(dto.country_name !== undefined && { country_name: dto.country_name }),
        ...(dto.organization !== undefined && { organization: dto.organization }),
        ...(dto.base_url !== undefined && { base_url: dto.base_url }),
        ...(dto.auth_type !== undefined && { auth_type: dto.auth_type }),
        ...(dto.credentials !== undefined && { credentials: dto.credentials }),
        ...(dto.headers !== undefined && { headers: dto.headers }),
        ...(dto.tls_config !== undefined && { tls_config: dto.tls_config }),
        ...(dto.domains !== undefined && { domains: dto.domains }),
        ...(dto.focal_technical !== undefined && { focal_technical: dto.focal_technical }),
        ...(dto.focal_data_owner !== undefined && { focal_data_owner: dto.focal_data_owner }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.config !== undefined && { config: dto.config }),
      },
    });

    this.logger.info(`Connection updated: ${id}`);
    return connection as HubConnection;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      this.throwHttp(404, `Connection ${id} not found`);
    }
    if (existing.status === 'ACTIVE') {
      this.throwHttp(400, 'Cannot delete an active connection. Suspend or archive it first.');
    }
    await this.db.delete({ where: { id } });
    this.logger.info(`Connection deleted: ${id}`);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  async activate(id: string, tenantId: string): Promise<HubConnection> {
    return this.changeStatus(id, tenantId, 'ACTIVE', TOPIC_AU_HUB_CONNECTION_ACTIVATED);
  }

  async suspend(id: string, tenantId: string): Promise<HubConnection> {
    return this.changeStatus(id, tenantId, 'SUSPENDED', TOPIC_AU_HUB_CONNECTION_SUSPENDED);
  }

  async archive(id: string, tenantId: string): Promise<HubConnection> {
    return this.changeStatus(id, tenantId, 'ARCHIVED', null);
  }

  async setTesting(id: string, tenantId: string): Promise<HubConnection> {
    return this.changeStatus(id, tenantId, 'TESTING', null);
  }

  private async changeStatus(
    id: string,
    tenantId: string,
    newStatus: HubConnectionStatus,
    kafkaTopic: string | null,
  ): Promise<HubConnection> {
    const existing = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) {
      this.throwHttp(404, `Connection ${id} not found`);
    }

    const connection = await this.db.update({
      where: { id },
      data: { status: newStatus },
    });

    if (kafkaTopic) {
      await this.publishEvent(kafkaTopic, id, {
        id,
        name: connection.name,
        status: newStatus,
        previousStatus: existing.status,
      }, tenantId);
    }

    this.logger.info(`Connection ${id} status changed: ${existing.status} → ${newStatus}`);
    return connection as HubConnection;
  }

  // ─── Health Check ───────────────────────────────────────────────

  async checkHealth(id: string, tenantId: string): Promise<{ status: HubHealthStatus; response_time_ms: number; message: string | null }> {
    const connection = await this.db.findFirst({ where: { id, tenant_id: tenantId } });
    if (!connection) {
      this.throwHttp(404, `Connection ${id} not found`);
    }

    const startMs = Date.now();
    let status: HubHealthStatus = 'DOWN';
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    if (connection.base_url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        const response = await fetch(connection.base_url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'ARIS-InteropHub/1.0' },
        });
        clearTimeout(timeoutId);

        statusCode = response.status;
        if (response.ok) {
          status = 'UP';
        } else if (response.status >= 500) {
          status = 'DEGRADED';
          errorMessage = `HTTP ${response.status}`;
        } else {
          status = 'UP'; // 4xx may be expected for HEAD
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          status = 'TIMEOUT';
          errorMessage = 'Connection timed out (10s)';
        } else {
          status = 'DOWN';
          errorMessage = err.message ?? 'Unknown error';
        }
      }
    } else {
      // No base_url configured — cannot check
      status = 'DOWN';
      errorMessage = 'No base_url configured';
    }

    const responseTimeMs = Date.now() - startMs;
    const previousHealthOk = connection.last_health_ok;
    const isHealthy = status === 'UP';

    // Record health check in DB
    await this.healthDb.create({
      data: {
        connection_id: id,
        status,
        response_time_ms: responseTimeMs,
        status_code: statusCode,
        error_message: errorMessage,
      },
    });

    // Update connection health fields
    await this.db.update({
      where: { id },
      data: {
        last_health_at: new Date(),
        last_health_ok: isHealthy,
        health_message: errorMessage,
      },
    });

    // Publish health change events
    if (!isHealthy && previousHealthOk !== false) {
      await this.publishEvent(TOPIC_AU_HUB_CONNECTION_HEALTH_DOWN, id, {
        id,
        name: connection.name,
        status,
        error: errorMessage,
      }, tenantId);
    } else if (isHealthy && previousHealthOk === false) {
      await this.publishEvent(TOPIC_AU_HUB_CONNECTION_HEALTH_RESTORED, id, {
        id,
        name: connection.name,
        status,
      }, tenantId);
    }

    return { status, response_time_ms: responseTimeMs, message: errorMessage };
  }

  // ─── Stats ──────────────────────────────────────────────────────

  async incrementStats(
    id: string,
    counters: { transactions?: number; records?: number; errors?: number },
  ): Promise<void> {
    await this.db.update({
      where: { id },
      data: {
        ...(counters.transactions && { total_transactions: { increment: counters.transactions } }),
        ...(counters.records && { total_records: { increment: counters.records } }),
        ...(counters.errors && { total_errors: { increment: counters.errors } }),
        last_transaction_at: new Date(),
      },
    });
  }
}
