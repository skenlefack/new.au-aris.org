// ═══════════════════════════════════════════════════════════════════
//  Agreement Manager — Bilateral data exchange agreements
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaEvent } from '@aris/shared-types';
import {
  TOPIC_AU_HUB_AGREEMENT_PROPOSED,
  TOPIC_AU_HUB_AGREEMENT_ACCEPTED,
  TOPIC_AU_HUB_AGREEMENT_REJECTED,
  TOPIC_AU_HUB_AGREEMENT_REVOKED,
} from '@aris/shared-types';
import type {
  HubAgreement,
  HubAgreementStatus,
  CreateAgreementDto,
  UpdateAgreementDto,
  PaginationParams,
  PaginatedResult,
  HubLogger,
} from './types';

const KAFKA_TIMEOUT_MS = 5_000;
const SERVICE_NAME = 'interop-hub';

export class AgreementService {
  private nextRefSequence = 1;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
    private readonly logger: HubLogger,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  private get db() {
    return (this.prisma as any).hubAgreement;
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

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    // Get the max existing reference number for this year
    const latest = await this.db.findFirst({
      where: { reference: { startsWith: `HUB-${year}-` } },
      orderBy: { reference: 'desc' },
    });

    let seq = 1;
    if (latest) {
      const parts = (latest.reference as string).split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `HUB-${year}-${String(seq).padStart(5, '0')}`;
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  async create(dto: CreateAgreementDto): Promise<HubAgreement> {
    // Validate connection
    const connection = await (this.prisma as any).hubConnection.findFirst({
      where: { id: dto.connection_id },
    });
    if (!connection) {
      this.throwHttp(404, `Connection ${dto.connection_id} not found`);
    }

    const reference = await this.generateReference();

    const agreement = await this.db.create({
      data: {
        connection_id: dto.connection_id,
        reference,
        tenant_id: dto.tenant_id,
        owner_tenant_id: dto.owner_tenant_id,
        owner_name: dto.owner_name,
        partner_tenant_id: dto.partner_tenant_id ?? null,
        partner_name: dto.partner_name,
        title: dto.title,
        description: dto.description ?? null,
        purpose: dto.purpose ?? null,
        legal_basis: dto.legal_basis ?? null,
        domains: dto.domains,
        direction: dto.direction,
        data_scope: dto.data_scope ?? null,
        data_classification: dto.data_classification ?? null,
        frequency: dto.frequency ?? null,
        timeliness_sla_hours: dto.timeliness_sla_hours ?? null,
        quality_min_score: dto.quality_min_score ?? null,
        valid_from: dto.valid_from ?? null,
        valid_until: dto.valid_until ?? null,
        created_by: dto.created_by,
      },
    });

    this.logger.info(`Agreement created: ${agreement.id} (${reference})`);
    return agreement as HubAgreement;
  }

  async findAll(
    tenantId: string,
    params: PaginationParams & { status?: HubAgreementStatus; connection_id?: string } = {},
  ): Promise<PaginatedResult<HubAgreement>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      OR: [
        { tenant_id: tenantId },
        { owner_tenant_id: tenantId },
        { partner_tenant_id: tenantId },
      ],
    };
    if (params.status) where.status = params.status;
    if (params.connection_id) where.connection_id = params.connection_id;

    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        include: { connection: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.db.count({ where }),
    ]);

    return {
      data: data as HubAgreement[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, tenantId: string): Promise<HubAgreement> {
    const agreement = await this.db.findFirst({
      where: {
        id,
        OR: [
          { tenant_id: tenantId },
          { owner_tenant_id: tenantId },
          { partner_tenant_id: tenantId },
        ],
      },
      include: { connection: true },
    });
    if (!agreement) {
      this.throwHttp(404, `Agreement ${id} not found`);
    }
    return agreement as HubAgreement;
  }

  async update(id: string, tenantId: string, dto: UpdateAgreementDto): Promise<HubAgreement> {
    const existing = await this.db.findFirst({
      where: { id, owner_tenant_id: tenantId },
    });
    if (!existing) {
      this.throwHttp(404, `Agreement ${id} not found or you are not the owner`);
    }
    if (existing.status !== 'DRAFT') {
      this.throwHttp(400, 'Only DRAFT agreements can be edited');
    }

    const agreement = await this.db.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
        ...(dto.legal_basis !== undefined && { legal_basis: dto.legal_basis }),
        ...(dto.domains !== undefined && { domains: dto.domains }),
        ...(dto.data_scope !== undefined && { data_scope: dto.data_scope }),
        ...(dto.data_classification !== undefined && { data_classification: dto.data_classification }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.timeliness_sla_hours !== undefined && { timeliness_sla_hours: dto.timeliness_sla_hours }),
        ...(dto.quality_min_score !== undefined && { quality_min_score: dto.quality_min_score }),
        ...(dto.valid_from !== undefined && { valid_from: dto.valid_from }),
        ...(dto.valid_until !== undefined && { valid_until: dto.valid_until }),
      },
      include: { connection: true },
    });

    this.logger.info(`Agreement updated: ${id}`);
    return agreement as HubAgreement;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.db.findFirst({
      where: { id, owner_tenant_id: tenantId },
    });
    if (!existing) {
      this.throwHttp(404, `Agreement ${id} not found`);
    }
    if (existing.status !== 'DRAFT') {
      this.throwHttp(400, 'Only DRAFT agreements can be deleted');
    }
    await this.db.delete({ where: { id } });
    this.logger.info(`Agreement deleted: ${id}`);
  }

  // ─── Workflow ───────────────────────────────────────────────────

  async propose(id: string, tenantId: string): Promise<HubAgreement> {
    const existing = await this.db.findFirst({
      where: { id, owner_tenant_id: tenantId },
    });
    if (!existing) {
      this.throwHttp(404, `Agreement ${id} not found`);
    }
    if (existing.status !== 'DRAFT') {
      this.throwHttp(400, `Cannot propose agreement in status ${existing.status}`);
    }

    const agreement = await this.db.update({
      where: { id },
      data: {
        status: 'PROPOSED' as HubAgreementStatus,
        proposed_at: new Date(),
      },
      include: { connection: true },
    });

    await this.publishEvent(TOPIC_AU_HUB_AGREEMENT_PROPOSED, id, {
      id,
      reference: agreement.reference,
      title: agreement.title,
      owner_name: agreement.owner_name,
      partner_name: agreement.partner_name,
    }, tenantId);

    this.logger.info(`Agreement ${id} proposed`);
    return agreement as HubAgreement;
  }

  async accept(id: string, tenantId: string): Promise<HubAgreement> {
    const existing = await this.db.findFirst({
      where: {
        id,
        OR: [
          { partner_tenant_id: tenantId },
          { tenant_id: tenantId },
        ],
      },
    });
    if (!existing) {
      this.throwHttp(404, `Agreement ${id} not found`);
    }
    if (existing.status !== 'PROPOSED' && existing.status !== 'UNDER_REVIEW') {
      this.throwHttp(400, `Cannot accept agreement in status ${existing.status}`);
    }

    const agreement = await this.db.update({
      where: { id },
      data: {
        status: 'ACTIVE' as HubAgreementStatus,
        accepted_at: new Date(),
        reviewed_at: new Date(),
      },
      include: { connection: true },
    });

    await this.publishEvent(TOPIC_AU_HUB_AGREEMENT_ACCEPTED, id, {
      id,
      reference: agreement.reference,
      title: agreement.title,
    }, tenantId);

    this.logger.info(`Agreement ${id} accepted`);
    return agreement as HubAgreement;
  }

  async reject(id: string, tenantId: string): Promise<HubAgreement> {
    const existing = await this.db.findFirst({
      where: {
        id,
        OR: [
          { partner_tenant_id: tenantId },
          { tenant_id: tenantId },
        ],
      },
    });
    if (!existing) {
      this.throwHttp(404, `Agreement ${id} not found`);
    }
    if (existing.status !== 'PROPOSED' && existing.status !== 'UNDER_REVIEW') {
      this.throwHttp(400, `Cannot reject agreement in status ${existing.status}`);
    }

    const agreement = await this.db.update({
      where: { id },
      data: {
        status: 'REJECTED' as HubAgreementStatus,
        rejected_at: new Date(),
        reviewed_at: new Date(),
      },
      include: { connection: true },
    });

    await this.publishEvent(TOPIC_AU_HUB_AGREEMENT_REJECTED, id, {
      id,
      reference: agreement.reference,
      title: agreement.title,
    }, tenantId);

    this.logger.info(`Agreement ${id} rejected`);
    return agreement as HubAgreement;
  }

  async revoke(id: string, tenantId: string): Promise<HubAgreement> {
    const existing = await this.db.findFirst({
      where: {
        id,
        OR: [
          { owner_tenant_id: tenantId },
          { partner_tenant_id: tenantId },
          { tenant_id: tenantId },
        ],
      },
    });
    if (!existing) {
      this.throwHttp(404, `Agreement ${id} not found`);
    }
    if (existing.status !== 'ACTIVE') {
      this.throwHttp(400, `Cannot revoke agreement in status ${existing.status}`);
    }

    const agreement = await this.db.update({
      where: { id },
      data: {
        status: 'REVOKED' as HubAgreementStatus,
        revoked_at: new Date(),
      },
      include: { connection: true },
    });

    await this.publishEvent(TOPIC_AU_HUB_AGREEMENT_REVOKED, id, {
      id,
      reference: agreement.reference,
      title: agreement.title,
    }, tenantId);

    this.logger.info(`Agreement ${id} revoked`);
    return agreement as HubAgreement;
  }

  // ─── Auto-Expire ───────────────────────────────────────────────

  /**
   * Check active agreements and mark expired ones.
   * Called periodically (e.g., daily by scheduler).
   */
  async checkExpired(): Promise<number> {
    const now = new Date();

    const expired = await this.db.updateMany({
      where: {
        status: 'ACTIVE',
        valid_until: { lt: now },
      },
      data: {
        status: 'EXPIRED' as HubAgreementStatus,
      },
    });

    if (expired.count > 0) {
      this.logger.info(`${expired.count} agreement(s) marked as expired`);
    }

    return expired.count;
  }

  // ─── SLA Compliance ─────────────────────────────────────────────

  /**
   * Calculate SLA compliance for an agreement based on transaction history.
   */
  async getSlaCompliance(id: string, tenantId: string): Promise<{
    agreement_id: string;
    timeliness_sla_hours: number | null;
    total_transactions: number;
    on_time: number;
    late: number;
    compliance_rate: number;
  }> {
    const agreement = await this.findById(id, tenantId);

    // Find all transactions for this connection + domains
    const transactions = await (this.prisma as any).hubTransaction.findMany({
      where: {
        connection_id: agreement.connection_id,
        domain: { in: agreement.domains },
        status: { in: ['COMPLETED', 'PARTIAL'] },
      },
      select: {
        id: true,
        started_at: true,
        completed_at: true,
        duration_ms: true,
      },
    });

    const slaHours = agreement.timeliness_sla_hours;
    let onTime = 0;
    let late = 0;

    if (slaHours) {
      const slaMs = slaHours * 3_600_000;
      for (const tx of transactions) {
        if (tx.duration_ms && tx.duration_ms <= slaMs) {
          onTime++;
        } else if (tx.started_at && tx.completed_at) {
          const duration = new Date(tx.completed_at).getTime() - new Date(tx.started_at).getTime();
          if (duration <= slaMs) {
            onTime++;
          } else {
            late++;
          }
        } else {
          late++;
        }
      }
    } else {
      onTime = transactions.length;
    }

    const total = transactions.length;
    const complianceRate = total > 0 ? onTime / total : 1.0;

    return {
      agreement_id: id,
      timeliness_sla_hours: slaHours,
      total_transactions: total,
      on_time: onTime,
      late,
      compliance_rate: Math.round(complianceRate * 10000) / 10000,
    };
  }
}
