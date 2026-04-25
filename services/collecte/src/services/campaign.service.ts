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
  CampaignDomainTargetEntity,
} from '../campaign/entities/campaign.entity';
import type { CampaignTargetInput } from '../schemas/campaign.schema';

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
      domain?: string;
      templateId: string;
      templateIds?: string[];
      targetCountries?: string[];
      startDate: string;
      endDate: string;
      targetZones?: string[];
      assignedAgents?: string[];
      targetSubmissions?: number;
      description?: string;
      frequency?: string;
      sendReminders?: boolean;
      reminderDaysBefore?: number;
      conflictStrategy?: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
      dataContractId?: string;
      targets?: CampaignTargetInput[];
    },
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CampaignEntity>> {
    // Validate targets if provided
    const targets = dto.targets;
    if (targets && targets.length > 0) {
      this.validateTargets(targets);
    }

    // Determine legacy domain: from targets (primary) or from dto.domain
    const domain = this.resolveDomain(dto.domain, targets);
    if (!domain) {
      throw new HttpError(400, 'Either "domain" or "targets" with a primary target must be provided');
    }

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
        domain,
        templateId: dto.templateId,
        templateIds: dto.templateIds ?? [],
        targetCountries: dto.targetCountries ?? [],
        startDate,
        endDate,
        targetZones: dto.targetZones ?? [],
        assignedAgents: dto.assignedAgents ?? [],
        targetSubmissions: dto.targetSubmissions ?? null,
        description: dto.description ?? null,
        conflictStrategy: dto.conflictStrategy ?? 'LAST_WRITE_WINS',
        dataContractId: dto.dataContractId ?? null,
        createdBy: user.userId,
      },
    });

    // Create domain targets
    const resolvedTargets = targets && targets.length > 0
      ? targets
      : [{ domainCode: domain, subDomainCode: null, isPrimary: true }];

    const createdTargets = await this.createDomainTargets(campaign.id, resolvedTargets);

    await this.publishEvent(TOPIC_MS_COLLECTE_CAMPAIGN_CREATED, campaign, user);

    console.log(
      `[CampaignService] Campaign created: ${campaign.name} (${campaign.id}) domain=${domain} with ${createdTargets.length} target(s)`,
    );

    return { data: { ...(campaign as unknown as CampaignEntity), targets: createdTargets } };
  }

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & {
      domain?: string;
      domainCode?: string;
      subDomainCode?: string;
      status?: string;
      zone?: string;
      search?: string;
    },
  ): Promise<PaginatedResponse<CampaignEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = await this.buildFilter(user, query);

    const [data, total] = await Promise.all([
      (this.prisma as any).campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { targets: true },
      }),
      (this.prisma as any).campaign.count({ where }),
    ]);

    return {
      data: data.map((c: any) => ({
        ...(c as unknown as CampaignEntity),
        targets: (c.targets ?? []).map(this.toTargetEntity),
      })),
      meta: { total, page, limit },
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<CampaignWithProgress>> {
    const campaign = await (this.prisma as any).campaign.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!campaign) {
      throw new HttpError(404, `Campaign ${id} not found`);
    }

    // Tenant isolation — allow access if the campaign targets the user's scope
    if (
      user.tenantLevel !== TenantLevel.CONTINENTAL &&
      campaign.tenantId !== user.tenantId
    ) {
      const canAccess = await this.canAccessCampaign(user, campaign);
      if (!canAccess) {
        throw new HttpError(404, `Campaign ${id} not found`);
      }
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
        targets: (campaign.targets ?? []).map(this.toTargetEntity),
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
      templateIds?: string[];
      targetCountries?: string[];
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

    // Editability: enforce hierarchy (lower level cannot edit higher level's campaigns)
    await this.assertCanEdit(user, existing);

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
        ...(dto.templateIds !== undefined && { templateIds: dto.templateIds }),
        ...(dto.targetCountries !== undefined && { targetCountries: dto.targetCountries }),
        ...(dto.targetSubmissions !== undefined && { targetSubmissions: dto.targetSubmissions }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.conflictStrategy !== undefined && { conflictStrategy: dto.conflictStrategy }),
      },
    });

    console.log(`[CampaignService] Campaign updated: ${campaign.name} (${campaign.id})`);

    return { data: campaign as unknown as CampaignEntity };
  }

  async delete(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ data: { id: string } }> {
    const existing = await (this.prisma as any).campaign.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, `Campaign ${id} not found`);
    }

    // Editability: enforce hierarchy
    await this.assertCanEdit(user, existing);

    // Only PLANNED campaigns can be deleted
    if (existing.status !== 'PLANNED') {
      throw new HttpError(400, `Only PLANNED campaigns can be deleted. This campaign is ${existing.status}.`);
    }

    await (this.prisma as any).campaign.delete({ where: { id } });
    console.log(`[CampaignService] Campaign deleted: ${existing.name} (${id})`);

    return { data: { id } };
  }

  /**
   * Build Prisma WHERE filter for campaign listing.
   *
   * Visibility rules:
   *  - CONTINENTAL → sees everything
   *  - REC → own campaigns + any campaign whose targetCountries overlaps
   *    with the REC's member-state country codes
   *  - MEMBER_STATE → own campaigns + any campaign whose targetCountries
   *    includes this country's ISO code
   */
  private async buildFilter(
    user: AuthenticatedUser,
    query: {
      domain?: string;
      domainCode?: string;
      subDomainCode?: string;
      status?: string;
      zone?: string;
      search?: string;
    },
  ): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};

    // Domain-based filtering: non-SUPER_ADMIN users only see campaigns
    // whose domain matches one of their assigned domains (from JWT).
    const userDomainCodes = Object.keys(user.domains ?? {});
    if (user.role !== 'SUPER_ADMIN' && userDomainCodes.length > 0) {
      where['domain'] = { in: userDomainCodes };
    }

    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      // AU sees everything — no tenant filter
    } else {
      // Resolve the user's tenant to find country codes
      const tenant = await (this.prisma as any).tenant.findUnique({
        where: { id: user.tenantId },
        select: { level: true, countryCode: true },
      });

      if (tenant?.level === 'MEMBER_STATE' && tenant.countryCode) {
        // Country sees: own campaigns OR campaigns targeting this country
        where['OR'] = [
          { tenantId: user.tenantId },
          { targetCountries: { has: tenant.countryCode.toUpperCase() } },
        ];
      } else if (tenant?.level === 'REC') {
        // REC sees: own campaigns OR campaigns targeting any of its member countries
        const memberTenants = await (this.prisma as any).tenant.findMany({
          where: { parentId: user.tenantId, level: 'MEMBER_STATE' },
          select: { countryCode: true },
        });
        const countryCodes: string[] = memberTenants
          .map((t: { countryCode: string | null }) => t.countryCode?.toUpperCase())
          .filter(Boolean);

        if (countryCodes.length > 0) {
          where['OR'] = [
            { tenantId: user.tenantId },
            { targetCountries: { hasSome: countryCodes } },
          ];
        } else {
          where['tenantId'] = user.tenantId;
        }
      } else {
        // Fallback: strict tenant isolation
        where['tenantId'] = user.tenantId;
      }
    }

    if (query.domain) {
      // Explicit domain filter from query — override the IN filter if allowed
      if (user.role === 'SUPER_ADMIN' || userDomainCodes.length === 0 || userDomainCodes.includes(query.domain)) {
        where['domain'] = query.domain;
      }
      // If user doesn't have access to the requested domain, the IN filter above keeps them restricted
    }

    // Multi-target filtering via CampaignDomainTarget join table
    if (query.domainCode || query.subDomainCode) {
      const targetWhere: Record<string, unknown> = {};
      if (query.domainCode) targetWhere['domainCode'] = query.domainCode;
      if (query.subDomainCode) targetWhere['subDomainCode'] = query.subDomainCode;
      where['targets'] = { some: targetWhere };
    }

    if (query.status) where['status'] = query.status;
    if (query.zone) {
      where['targetZones'] = { has: query.zone };
    }
    if (query.search) {
      where['name'] = { contains: query.search, mode: 'insensitive' };
    }

    return where;
  }

  /** Check if a REC/MS user can access a campaign that wasn't created by them */
  private async canAccessCampaign(
    user: AuthenticatedUser,
    campaign: { targetCountries?: string[] },
  ): Promise<boolean> {
    const targets = campaign.targetCountries ?? [];
    if (targets.length === 0) return false;

    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: user.tenantId },
      select: { level: true, countryCode: true },
    });
    if (!tenant) return false;

    if (tenant.level === 'MEMBER_STATE' && tenant.countryCode) {
      return targets.includes(tenant.countryCode.toUpperCase());
    }

    if (tenant.level === 'REC') {
      const memberTenants = await (this.prisma as any).tenant.findMany({
        where: { parentId: user.tenantId, level: 'MEMBER_STATE' },
        select: { countryCode: true },
      });
      const countryCodes: string[] = memberTenants
        .map((t: { countryCode: string | null }) => t.countryCode?.toUpperCase())
        .filter(Boolean);
      return targets.some((c: string) => countryCodes.includes(c.toUpperCase()));
    }

    return false;
  }

  /**
   * Assert the user can edit/delete a campaign; throws 403 if not.
   *
   * Rules:
   *  - CONTINENTAL can edit everything
   *  - Owner can always edit their own campaign
   *  - REC can edit campaigns created by their member states
   *  - MEMBER_STATE can only edit own campaigns (cannot edit REC/continental)
   */
  private async assertCanEdit(
    user: AuthenticatedUser,
    campaign: { tenantId: string },
  ): Promise<void> {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (campaign.tenantId === user.tenantId) return;

    // REC may edit campaigns created by member states
    if (user.tenantLevel === TenantLevel.REC) {
      const ownerTenant = await (this.prisma as any).tenant.findUnique({
        where: { id: campaign.tenantId },
        select: { level: true, parentId: true },
      });
      if (ownerTenant?.level === 'MEMBER_STATE' && ownerTenant.parentId === user.tenantId) {
        return;
      }
    }

    // Resolve the campaign owner's level for a descriptive error
    const ownerTenant = await (this.prisma as any).tenant.findUnique({
      where: { id: campaign.tenantId },
      select: { level: true },
    });
    const ownerLevel = ownerTenant?.level ?? 'unknown';

    throw new HttpError(
      403,
      `Cannot modify a campaign created at ${ownerLevel} level. ` +
      `Only users at that level or above can edit it.`,
    );
  }

  // ── Target helpers ──

  /**
   * Validate targets array: at least 1 target, exactly 1 isPrimary when >1 target.
   */
  validateTargets(targets: CampaignTargetInput[]): void {
    if (targets.length === 0) {
      throw new HttpError(400, 'At least one target is required');
    }

    const primaryCount = targets.filter((t) => t.isPrimary === true).length;

    if (targets.length === 1) {
      // Single target is always primary, auto-set
      return;
    }

    if (primaryCount !== 1) {
      throw new HttpError(
        400,
        `Exactly 1 primary target is required when multiple targets are provided (found ${primaryCount})`,
      );
    }
  }

  /**
   * Determine the legacy domain field value.
   */
  private resolveDomain(
    dtoDomain: string | undefined,
    targets: CampaignTargetInput[] | undefined,
  ): string | undefined {
    if (targets && targets.length > 0) {
      if (targets.length === 1) return targets[0].domainCode;
      const primary = targets.find((t) => t.isPrimary === true);
      return primary?.domainCode ?? targets[0].domainCode;
    }
    return dtoDomain;
  }

  /**
   * Create CampaignDomainTarget records for a campaign.
   */
  private async createDomainTargets(
    campaignId: string,
    targets: CampaignTargetInput[],
  ): Promise<CampaignDomainTargetEntity[]> {
    const normalized = targets.length === 1
      ? [{ ...targets[0], isPrimary: true }]
      : targets;

    const created: CampaignDomainTargetEntity[] = [];
    for (const target of normalized) {
      const row = await (this.prisma as any).campaignDomainTarget.create({
        data: {
          campaignId,
          domainCode: target.domainCode,
          subDomainCode: target.subDomainCode ?? null,
          isPrimary: target.isPrimary ?? false,
        },
      });
      created.push(this.toTargetEntity(row));
    }
    return created;
  }

  /**
   * Map a Prisma CampaignDomainTarget row to entity.
   */
  private toTargetEntity(row: {
    id: string;
    campaignId: string;
    domainCode: string;
    subDomainCode: string | null;
    isPrimary: boolean;
    createdAt: Date;
  }): CampaignDomainTargetEntity {
    return {
      id: row.id,
      campaignId: row.campaignId,
      domainCode: row.domainCode,
      subDomainCode: row.subDomainCode,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
    };
  }

  // ── Kafka Events ──

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
