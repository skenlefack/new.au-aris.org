import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyKafka } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import type { CreateSubDomainInput, UpdateSubDomainInput } from '../schemas/subdomain.schemas.js';

const SERVICE_NAME = 'credential-service';

// ─── Kafka topic constants ───────────────────────────────────────────────────
const TOPIC_SUBDOMAIN_CREATED     = 'sys.credential.subdomain.created.v1';
const TOPIC_SUBDOMAIN_UPDATED     = 'sys.credential.subdomain.updated.v1';
const TOPIC_SUBDOMAIN_DELETED     = 'sys.credential.subdomain.deleted.v1';
const TOPIC_SUBDOMAIN_ACTIVATED   = 'sys.credential.subdomain.activated.v1';
const TOPIC_SUBDOMAIN_DEACTIVATED = 'sys.credential.subdomain.deactivated.v1';

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class SubDomainService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: FastifyKafka,
  ) {}

  private db() { return this.prisma as any; }

  private makeHeaders(actorUserId: string, tenantId?: string): KafkaHeaders {
    return {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: tenantId ?? '',
      userId: actorUserId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
  }

  private async publishEvent(topic: string, key: string, payload: Record<string, unknown>, actorUserId: string, tenantId?: string) {
    const kafkaSend = this.kafka.send(topic, key, payload, this.makeHeaders(actorUserId, tenantId));
    const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 5000));
    Promise.race([kafkaSend, timeout]).catch(() => { /* non-blocking */ });
  }

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(input: CreateSubDomainInput, actorUserId: string, tenantId?: string) {
    const { domainCode, valueChainCode, ...rest } = input;

    // Resolve domain
    const domain = await this.db().domain.findUnique({ where: { code: domainCode } });
    if (!domain) throw new HttpError(404, `Domain '${domainCode}' not found`);

    // Check unique code within domain
    const existing = await this.db().subDomain.findUnique({
      where: { domainId_code: { domainId: domain.id, code: rest.code } },
    });
    if (existing) throw new HttpError(400, `Sub-domain code '${rest.code}' already exists in domain '${domainCode}'`);

    // Validate valueChainCode if provided
    if (valueChainCode) {
      const vcc = await this.db().valueChainCode.findUnique({ where: { code: valueChainCode } });
      if (!vcc) throw new HttpError(422, `Value chain code '${valueChainCode}' does not exist`);
    }

    const subDomain = await this.db().subDomain.create({
      data: {
        ...rest,
        domainId: domain.id,
        valueChainCode: valueChainCode ?? null,
        active: rest.active ?? true,
        displayOrder: rest.displayOrder ?? 0,
      },
      include: { domain: { select: { code: true } } },
    });

    await this.publishEvent(TOPIC_SUBDOMAIN_CREATED, subDomain.id, {
      subDomainId: subDomain.id,
      code: subDomain.code,
      domainCode,
      valueChainCode: subDomain.valueChainCode,
      typeEnum: subDomain.typeEnum,
      timestamp: new Date().toISOString(),
      actorUserId,
    }, actorUserId, tenantId);

    return { data: subDomain };
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateSubDomainInput, actorUserId: string, tenantId?: string) {
    const current = await this.db().subDomain.findUnique({
      where: { id },
      include: { domain: { select: { code: true } } },
    });
    if (!current) throw new HttpError(404, `Sub-domain '${id}' not found`);

    // Validate valueChainCode if changing
    if (input.valueChainCode !== undefined && input.valueChainCode !== null) {
      const vcc = await this.db().valueChainCode.findUnique({ where: { code: input.valueChainCode } });
      if (!vcc) throw new HttpError(422, `Value chain code '${input.valueChainCode}' does not exist`);
    }

    const updated = await this.db().subDomain.update({
      where: { id },
      data: {
        ...input,
        valueChainCode: input.valueChainCode === null ? null : (input.valueChainCode ?? undefined),
      },
      include: { domain: { select: { code: true } } },
    });

    // Determine which event to emit
    if (input.active !== undefined && input.active !== current.active) {
      const topic = input.active ? TOPIC_SUBDOMAIN_ACTIVATED : TOPIC_SUBDOMAIN_DEACTIVATED;
      await this.publishEvent(topic, id, {
        subDomainId: id,
        code: current.code,
        domainCode: current.domain.code,
        active: input.active,
        timestamp: new Date().toISOString(),
        actorUserId,
      }, actorUserId, tenantId);
    } else {
      await this.publishEvent(TOPIC_SUBDOMAIN_UPDATED, id, {
        subDomainId: id,
        code: current.code,
        domainCode: current.domain.code,
        changes: input,
        timestamp: new Date().toISOString(),
        actorUserId,
      }, actorUserId, tenantId);
    }

    return { data: updated };
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async delete(id: string, actorUserId: string, tenantId?: string) {
    const current = await this.db().subDomain.findUnique({
      where: { id },
      include: { domain: { select: { code: true } } },
    });
    if (!current) throw new HttpError(404, `Sub-domain '${id}' not found`);

    // Phase 2+ : check if any business data references this sub-domain
    // For now, no tables reference sub_domain_id yet, so deletion is always allowed.

    await this.db().subDomain.delete({ where: { id } });

    await this.publishEvent(TOPIC_SUBDOMAIN_DELETED, id, {
      subDomainId: id,
      code: current.code,
      domainCode: current.domain.code,
      timestamp: new Date().toISOString(),
      actorUserId,
    }, actorUserId, tenantId);

    return { data: { id, deleted: true } };
  }

  // ─── GET BY ID (admin) ────────────────────────────────────────────────────────

  async getById(id: string) {
    const subDomain = await this.db().subDomain.findUnique({
      where: { id },
      include: { domain: { select: { code: true, name: true } } },
    });
    if (!subDomain) throw new HttpError(404, `Sub-domain '${id}' not found`);
    return { data: subDomain };
  }

  // ─── LIST (admin, paginated with filters) ────────────────────────────────────

  async list(filters: {
    domainCode?: string;
    typeEnum?: string;
    active?: string;
    valueChainCode?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.domainCode) {
      const domain = await this.db().domain.findUnique({ where: { code: filters.domainCode } });
      if (domain) where.domainId = domain.id;
      else return { data: [], meta: { total: 0, page, limit } };
    }
    if (filters.typeEnum) where.typeEnum = filters.typeEnum;
    if (filters.active !== undefined) where.active = filters.active === 'true';
    if (filters.valueChainCode) where.valueChainCode = filters.valueChainCode;
    if (filters.search) {
      const q = filters.search;
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { labelFr: { contains: q, mode: 'insensitive' } },
        { labelEn: { contains: q, mode: 'insensitive' } },
        { valueChainCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db().subDomain.findMany({
        where,
        include: { domain: { select: { code: true, name: true } } },
        orderBy: [{ domainId: 'asc' }, { displayOrder: 'asc' }],
        skip,
        take: limit,
      }),
      this.db().subDomain.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ─── GET BY DOMAIN (consultation) ────────────────────────────────────────────

  async listByDomain(domainCode: string, activeOnly = true) {
    const domain = await this.db().domain.findUnique({ where: { code: domainCode } });
    if (!domain) throw new HttpError(404, `Domain '${domainCode}' not found`);

    const where: any = { domainId: domain.id };
    if (activeOnly) where.active = true;

    const subDomains = await this.db().subDomain.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });

    return { data: subDomains };
  }

  // ─── TRANSVERSE: by value chain code ─────────────────────────────────────────

  async listByValueChainCode(valueChainCode: string) {
    const vcc = await this.db().valueChainCode.findUnique({ where: { code: valueChainCode } });
    if (!vcc) throw new HttpError(404, `Value chain code '${valueChainCode}' not found`);

    const subDomains = await this.db().subDomain.findMany({
      where: { valueChainCode, active: true },
      include: { domain: { select: { code: true, name: true } } },
      orderBy: { displayOrder: 'asc' },
    });

    return { data: subDomains, valueChain: vcc };
  }
}
