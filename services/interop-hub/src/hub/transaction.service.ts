// ═══════════════════════════════════════════════════════════════════
//  Transaction Service — Query, inbox/outbox, approve/reject, stats
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaEvent } from '@aris/shared-types';
import {
  TOPIC_AU_HUB_INBOUND_APPROVED,
  TOPIC_AU_HUB_INBOUND_REJECTED,
  TOPIC_AU_HUB_OUTBOUND_APPROVED,
  TOPIC_AU_HUB_OUTBOUND_REJECTED,
} from '@aris/shared-types';
import type {
  HubTransaction,
  HubTransactionStatus,
  HubDirection,
  TransactionFilters,
  PaginatedResult,
  HubLogger,
} from './types';
import type { PipelineEngineService } from './pipeline-engine.service';

const KAFKA_TIMEOUT_MS = 5_000;
const SERVICE_NAME = 'interop-hub';

export class TransactionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly pipelineEngine: PipelineEngineService,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubTransaction;
  }

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

  // ─── Queries ────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    filters: TransactionFilters = {},
  ): Promise<PaginatedResult<HubTransaction>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.domain) where.domain = filters.domain;
    if (filters.connection_id) where.connection_id = filters.connection_id;
    if (filters.date_from || filters.date_to) {
      where.created_at = {
        ...(filters.date_from && { gte: filters.date_from }),
        ...(filters.date_to && { lte: filters.date_to }),
      };
    }

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        include: { connection: true, pipeline: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubTransaction[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, tenantId: string): Promise<HubTransaction> {
    const transaction = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        connection: true,
        pipeline: true,
        records: { orderBy: { record_index: 'asc' } },
        steps_log: { orderBy: { step_order: 'asc' } },
      },
    });
    if (!transaction) {
      this.throwHttp(404, `Transaction ${id} not found`);
    }
    return transaction as HubTransaction;
  }

  // ─── Inbox / Outbox ─────────────────────────────────────────────

  async inbox(
    tenantId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResult<HubTransaction>> {
    return this.findAll(tenantId, {
      direction: 'INBOUND',
      status: 'AWAITING_REVIEW',
      ...params,
    });
  }

  async outbox(
    tenantId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResult<HubTransaction>> {
    return this.findAll(tenantId, {
      direction: 'OUTBOUND',
      status: 'AWAITING_REVIEW',
      ...params,
    });
  }

  // ─── Approve / Reject ──────────────────────────────────────────

  async approve(
    id: string,
    tenantId: string,
    reviewedBy: string,
    reviewNotes?: string,
  ): Promise<HubTransaction> {
    const transaction = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!transaction) {
      this.throwHttp(404, `Transaction ${id} not found`);
    }
    if (transaction.status !== 'AWAITING_REVIEW') {
      this.throwHttp(400, `Transaction ${id} is not awaiting review (status: ${transaction.status})`);
    }

    // Mark as approved
    await this.db.update({
      where: { id },
      data: {
        status: 'APPROVED' as HubTransactionStatus,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        review_notes: reviewNotes ?? null,
      },
    });

    // Publish approve event
    const topic = transaction.direction === 'INBOUND'
      ? TOPIC_AU_HUB_INBOUND_APPROVED
      : TOPIC_AU_HUB_OUTBOUND_APPROVED;
    await this.publishEvent(topic, id, {
      transactionId: id,
      reviewedBy,
      direction: transaction.direction,
    }, tenantId);

    // Resume pipeline execution (runs remaining steps after NOTIFY)
    const resumed = await this.pipelineEngine.resumeTransaction(id, tenantId);
    this.logger.info(`Transaction ${id} approved by ${reviewedBy} and resumed`);
    return resumed;
  }

  async reject(
    id: string,
    tenantId: string,
    reviewedBy: string,
    reviewNotes: string,
  ): Promise<HubTransaction> {
    const transaction = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!transaction) {
      this.throwHttp(404, `Transaction ${id} not found`);
    }
    if (transaction.status !== 'AWAITING_REVIEW') {
      this.throwHttp(400, `Transaction ${id} is not awaiting review (status: ${transaction.status})`);
    }

    const updated = await this.db.update({
      where: { id },
      data: {
        status: 'REJECTED' as HubTransactionStatus,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        review_notes: reviewNotes,
        completed_at: new Date(),
      },
      include: {
        connection: true,
        pipeline: true,
        records: true,
        steps_log: { orderBy: { step_order: 'asc' } },
      },
    });

    const topic = transaction.direction === 'INBOUND'
      ? TOPIC_AU_HUB_INBOUND_REJECTED
      : TOPIC_AU_HUB_OUTBOUND_REJECTED;
    await this.publishEvent(topic, id, {
      transactionId: id,
      reviewedBy,
      reason: reviewNotes,
      direction: transaction.direction,
    }, tenantId);

    this.logger.info(`Transaction ${id} rejected by ${reviewedBy}: ${reviewNotes}`);
    return updated as HubTransaction;
  }

  // ─── Retry / Cancel ─────────────────────────────────────────────

  async retry(id: string, tenantId: string, initiatedBy: string): Promise<HubTransaction> {
    const transaction = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!transaction) {
      this.throwHttp(404, `Transaction ${id} not found`);
    }
    if (transaction.status !== 'FAILED' && transaction.status !== 'RETRY') {
      this.throwHttp(400, `Transaction ${id} cannot be retried (status: ${transaction.status})`);
    }
    if (transaction.retry_count >= transaction.max_retries) {
      this.throwHttp(400, `Transaction ${id} has exceeded max retries (${transaction.max_retries})`);
    }

    // Increment retry count
    await this.db.update({
      where: { id },
      data: {
        status: 'RETRY' as HubTransactionStatus,
        retry_count: { increment: 1 },
        error_message: null,
      },
    });

    // Re-execute the pipeline with original source data
    const sourceRecords = (transaction.source_payload ?? []) as Record<string, unknown>[];
    const result = await this.pipelineEngine.executePipeline(
      transaction.pipeline_id,
      {
        records: sourceRecords,
        source_file_url: transaction.source_file_url,
        source_file_name: transaction.source_file_name,
        source_file_size: transaction.source_file_size,
        metadata: { retry_of: id },
      },
      initiatedBy,
    );

    this.logger.info(`Transaction ${id} retried as ${result.id}`);
    return result;
  }

  async cancel(id: string, tenantId: string): Promise<HubTransaction> {
    const transaction = await this.db.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!transaction) {
      this.throwHttp(404, `Transaction ${id} not found`);
    }

    const terminalStatuses: HubTransactionStatus[] = ['COMPLETED', 'CANCELLED'];
    if (terminalStatuses.includes(transaction.status)) {
      this.throwHttp(400, `Transaction ${id} cannot be cancelled (status: ${transaction.status})`);
    }

    const updated = await this.db.update({
      where: { id },
      data: {
        status: 'CANCELLED' as HubTransactionStatus,
        completed_at: new Date(),
      },
      include: { connection: true, pipeline: true },
    });

    this.logger.info(`Transaction ${id} cancelled`);
    return updated as HubTransaction;
  }

  // ─── Dashboard Stats ───────────────────────────────────────────

  async getDashboardStats(tenantId: string): Promise<{
    by_status: Record<string, number>;
    by_direction: Record<string, number>;
    by_domain: Record<string, number>;
    by_connection: Array<{ connection_id: string; connection_name: string; count: number }>;
    volume_over_time: Array<{ date: string; count: number }>;
    totals: { transactions: number; records: number; accepted: number; rejected: number };
  }> {
    // By status
    const statusCounts = await this.db.groupBy({
      by: ['status'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    });
    const by_status: Record<string, number> = {};
    for (const row of statusCounts) {
      by_status[row.status] = row._count.id;
    }

    // By direction
    const directionCounts = await this.db.groupBy({
      by: ['direction'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    });
    const by_direction: Record<string, number> = {};
    for (const row of directionCounts) {
      by_direction[row.direction] = row._count.id;
    }

    // By domain
    const domainCounts = await this.db.groupBy({
      by: ['domain'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    });
    const by_domain: Record<string, number> = {};
    for (const row of domainCounts) {
      by_domain[row.domain] = row._count.id;
    }

    // By connection (with name)
    const connectionCounts = await this.db.groupBy({
      by: ['connection_id'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    });
    const connectionIds = connectionCounts.map((r: any) => r.connection_id);
    const connections = connectionIds.length > 0
      ? await (this.prisma as any).hubConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, name: true },
        })
      : [];
    const connNameMap = new Map(connections.map((c: any) => [c.id, c.name]));
    const by_connection = connectionCounts.map((r: any) => ({
      connection_id: r.connection_id,
      connection_name: connNameMap.get(r.connection_id) ?? 'Unknown',
      count: r._count.id,
    }));

    // Volume over time (last 30 days, grouped by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await this.db.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: thirtyDaysAgo },
      },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });

    const dailyCounts = new Map<string, number>();
    for (const tx of recentTransactions) {
      const dateStr = (tx.created_at as Date).toISOString().split('T')[0];
      dailyCounts.set(dateStr, (dailyCounts.get(dateStr) ?? 0) + 1);
    }
    const volume_over_time = Array.from(dailyCounts.entries()).map(([date, count]) => ({ date, count }));

    // Totals
    const aggregates = await this.db.aggregate({
      where: { tenant_id: tenantId },
      _count: { id: true },
      _sum: {
        records_total: true,
        records_accepted: true,
        records_rejected: true,
      },
    });

    const totals = {
      transactions: aggregates._count.id ?? 0,
      records: aggregates._sum.records_total ?? 0,
      accepted: aggregates._sum.records_accepted ?? 0,
      rejected: aggregates._sum.records_rejected ?? 0,
    };

    return { by_status, by_direction, by_domain, by_connection, volume_over_time, totals };
  }
}
