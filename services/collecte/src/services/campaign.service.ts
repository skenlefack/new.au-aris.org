import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  TOPIC_MS_COLLECTE_CAMPAIGN_CREATED,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  KafkaHeaders,
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  CampaignEntity,
  CampaignWithProgress,
} from '../campaign/entities/campaign.entity';

const SERVICE_NAME = 'collecte-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Valid status transitions for campaigns */
const VALID_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class CampaignService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
  ) {}

  async create(
    dto: {
      name: string;
      domain: string;
      templateId: string;
      startDate: string;
      endDate: string;
      targetZones: string[];
      assignedAgents: string[];
      targetSubmissions?: number;
      description?: string;
      conflictStrategy?: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
      dataContractId?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CampaignEntity>> {
    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new HttpError(400, 'endDate must be after startDate');
    }

    const campaign = await (this.prisma as any).campaign.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        domain: dto.domain,
        templateId: dto.templateId,
        startDate,
        endDate,
        targetZones: dto.targetZones,
        assignedAgents: dto.assignedAgents,
        targetSubmissions: dto.targetSubmissions ?? null,
        description: dto.description ?? null,
        conflictStrategy: dto.conflictStrategy ?? 'LAST_WRITE_WINS',
        dataContractId: dto.dataContractId ?? null,
        createdBy: user.userId,
      },
    });

    await this.publishEvent(TOPIC_MS_COLLECTE_CAMPAIGN_CREATED, campaign, user);

    console.log(
      `[CampaignService] Campaign created: ${campaign.name} (${campaign.id}) domain=${dto.domain}`,
    );

    return { data: campaign as unknown as CampaignEntity };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & { domain?: string; status?: string; zone?: string },
  ): Promise<PaginatedResponse<CampaignEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = this.buildFilter(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).campaign.count({ where }),
    ]);

    return {
      data: data as unknown as CampaignEntity[],
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CampaignWithProgress>> {
    const campaign = await (this.prisma as any).campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new HttpError(404, `Campaign ${id} not found`);
    }

    // Tenant isolation
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      campaign.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Campaign ${id} not found`);
    }

    // Compute progress stats
    const [totalSubmissions, validated, rejected] = await Promise.all([
      (this.prisma as any).submission.count({ where: { campaignId: id } }),
      (this.prisma as any).submission.count({
        where: { campaignId: id, status: 'VALIDATED' },
      }),
      (this.prisma as any).submission.count({
        where: { campaignId: id, status: 'REJECTED' },
      }),
    ]);

    const pending = totalSubmissions - validated - rejected;
    const target = campaign.targetSubmissions ?? (totalSubmissions || 1);
    const completionRate =
      Math.round((validated / target) * 10000) / 100;

    return {
      data: {
        ...(campaign as unknown as CampaignEntity),
        progress: {
          totalSubmissions,
          validated,
          rejected,
          pending,
          completionRate,
        },
      },
    };
  }

  async update(
    id: string,
    dto: {
      name?: string;
      startDate?: string;
      endDate?: string;
      targetZones?: string[];
      assignedAgents?: string[];
      targetSubmissions?: number;
      description?: string;
      status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
      conflictStrategy?: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CampaignEntity>> {
    const existing = await (this.prisma as any).campaign.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Campaign ${id} not found`);
    }

    // Tenant isolation
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      existing.tenantId !== user.tenantId
    ) {
      throw new HttpError(404, `Campaign ${id} not found`);
    }

    // Validate status transition
    if (dto.status && dto.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new HttpError(
          400,
          `Cannot transition campaign from ${existing.status} to ${dto.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    const campaign = await (this.prisma as any).campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.targetZones !== undefined && { targetZones: dto.targetZones }),
        ...(dto.assignedAgents !== undefined && { assignedAgents: dto.assignedAgents }),
        ...(dto.targetSubmissions !== undefined && { targetSubmissions: dto.targetSubmissions }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.conflictStrategy !== undefined && { conflictStrategy: dto.conflictStrategy }),
      },
    });

    console.log(`[CampaignService] Campaign updated: ${campaign.name} (${campaign.id})`);

    return { data: campaign as unknown as CampaignEntity };
  }

  private buildFilter(
    user: AuthenticatedUser,
    query: { domain?: string; status?: string; zone?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
      where['tenantId'] = user.tenantId;
    }

    if (query.domain) where['domain'] = query.domain;
    if (query.status) where['status'] = query.status;
    if (query.zone) {
      where['targetZones'] = { has: query.zone };
    }

    return where;
  }

  private async publishEvent(
    topic: string,
    campaign: unknown,
    user: AuthenticatedUser,
  ): Promise<void> {
    const c = campaign as CampaignEntity;
    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: user.tenantId,
      userId: user.userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    const payload = {
      campaignId: c.id,
      name: c.name,
      domain: c.domain,
      templateId: c.templateId,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
    };

    try {
      await this.kafkaProducer.send(topic, c.id, payload, headers);
    } catch (error) {
      console.error(
        `[CampaignService] Failed to publish event for campaign ${c.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
