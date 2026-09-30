import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import { TenantLevel, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@aris/shared-types';
import type { KafkaHeaders } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { AuditService } from './audit.service.js';
import {
  TOPIC_SYS_PROGRAMME_CREATED,
  TOPIC_SYS_PROGRAMME_UPDATED,
} from '../kafka-topics.js';

const SERVICE_NAME = 'programme-monitoring-service';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class ProgrammeService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async create(dto: any, user: AuthenticatedUser) {
    const classification = dto.dataClassification ?? 'PARTNER';

    // Check unique code per tenant
    const existing = await (this.prisma as any).programme.findFirst({
      where: { code: dto.code, tenantId: user.tenantId },
    });
    if (existing) {
      throw new HttpError(409, `Programme with code '${dto.code}' already exists`);
    }

    const programme = await (this.prisma as any).programme.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        donorName: dto.donorName ?? null,
        donorReference: dto.donorReference ?? null,
        currency: dto.currency ?? 'EUR',
        totalBudget: dto.totalBudget,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? 'DESIGN',
        logframeType: dto.logframeType ?? 'LOGFRAME',
        reportingFrequency: dto.reportingFrequency ?? 'MONTHLY',
        level: dto.level ?? 'CONTINENTAL',
        geoScope: dto.geoScope ?? [],
        dataClassification: classification,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });

    // Create nested components → outputs if provided
    if (dto.components?.length) {
      for (let ci = 0; ci < dto.components.length; ci++) {
        const comp = dto.components[ci];
        const component = await (this.prisma as any).programmeComponent.create({
          data: {
            programmeId: programme.id,
            code: comp.code,
            name: comp.name,
            description: comp.description ?? null,
            color: comp.color ?? null,
            sortOrder: ci,
          },
        });

        if (comp.outputs?.length) {
          for (let oi = 0; oi < comp.outputs.length; oi++) {
            const out = comp.outputs[oi];
            await (this.prisma as any).programmeOutput.create({
              data: {
                componentId: component.id,
                code: out.code,
                name: out.name,
                description: out.description ?? null,
                approvedBudget: out.approvedBudget ?? 0,
                sortOrder: oi,
              },
            });
          }
        }
      }
    }

    const result = await this.findOne(programme.id, user);

    this.audit.log('Programme', programme.id, 'CREATE', user, classification as any, {
      newVersion: result.data as unknown as object,
    });

    await this.publishEvent(TOPIC_SYS_PROGRAMME_CREATED, programme, user);

    return result;
  }

  async findAll(
    user: AuthenticatedUser,
    query: { page?: number; limit?: number; sort?: string; order?: string },
    filter: any,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'desc' }
      : { createdAt: 'desc' as const };

    const where = this.buildWhere(user, filter);

    const [data, total] = await Promise.all([
      (this.prisma as any).programme.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          components: {
            orderBy: { sortOrder: 'asc' },
            include: {
              outputs: { orderBy: { sortOrder: 'asc' } },
            },
          },
          _count: { select: { risks: true, teamMembers: true, reportingCycles: true } },
        },
      }),
      (this.prisma as any).programme.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const programme = await (this.prisma as any).programme.findUnique({
      where: { id },
      include: {
        components: {
          orderBy: { sortOrder: 'asc' },
          include: {
            outputs: {
              orderBy: { sortOrder: 'asc' },
              include: {
                activities: { orderBy: { code: 'asc' } },
                indicators: true,
              },
            },
          },
        },
        risks: { orderBy: { riskScore: 'desc' } },
        teamMembers: true,
        _count: { select: { reportingCycles: true, snapshots: true } },
      },
    });

    if (!programme) {
      throw new HttpError(404, `Programme ${id} not found`);
    }

    this.verifyTenantAccess(user, programme.tenantId);

    return { data: programme };
  }

  async update(id: string, dto: any, user: AuthenticatedUser) {
    const existing = await (this.prisma as any).programme.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Programme ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenantId);

    const updateData: Record<string, unknown> = { updatedBy: user.userId };

    if (dto.code !== undefined) updateData['code'] = dto.code;
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.donorName !== undefined) updateData['donorName'] = dto.donorName;
    if (dto.donorReference !== undefined) updateData['donorReference'] = dto.donorReference;
    if (dto.currency !== undefined) updateData['currency'] = dto.currency;
    if (dto.totalBudget !== undefined) updateData['totalBudget'] = dto.totalBudget;
    if (dto.startDate !== undefined) updateData['startDate'] = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData['endDate'] = new Date(dto.endDate);
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.logframeType !== undefined) updateData['logframeType'] = dto.logframeType;
    if (dto.reportingFrequency !== undefined) updateData['reportingFrequency'] = dto.reportingFrequency;
    if (dto.level !== undefined) updateData['level'] = dto.level;
    if (dto.geoScope !== undefined) updateData['geoScope'] = dto.geoScope;
    if (dto.dataClassification !== undefined) updateData['dataClassification'] = dto.dataClassification;

    const updated = await (this.prisma as any).programme.update({
      where: { id },
      data: updateData,
    });

    this.audit.log('Programme', id, 'UPDATE', user, updated.dataClassification as any, {
      previousVersion: existing as unknown as object,
      newVersion: updated as unknown as object,
    });

    await this.publishEvent(TOPIC_SYS_PROGRAMME_UPDATED, updated, user);

    return { data: updated };
  }

  private buildWhere(user: AuthenticatedUser, filter: any): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel === TenantLevel.MEMBER_STATE || user.tenantLevel === TenantLevel.REC) {
      where['tenantId'] = user.tenantId;
    }

    if (filter.status) where['status'] = filter.status;
    if (filter.level) where['level'] = filter.level;
    if (filter.donorName) where['donorName'] = { contains: filter.donorName, mode: 'insensitive' };

    return where;
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (user.tenantId === tenantId) return;
    throw new HttpError(404, 'Resource not found');
  }

  private async publishEvent(
    topic: string,
    payload: { id: string; [key: string]: unknown },
    user: AuthenticatedUser,
  ): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try {
      await Promise.race([
        this.kafka.send(topic, payload.id, payload, headers),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 5000)),
      ]);
    } catch (error) {
      console.error(`Failed to publish ${topic}`, error);
    }
  }
}
