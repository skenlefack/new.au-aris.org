import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import {
  TenantLevel,
  WorkflowLevel,
  UserRole,
  TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
  TOPIC_AU_WORKFLOW_VALIDATION_RETURNED,
  TOPIC_AU_WORKFLOW_VALIDATION_ESCALATED,
  TOPIC_AU_WORKFLOW_WAHIS_READY,
  TOPIC_AU_WORKFLOW_ANALYTICS_READY,
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
  WorkflowInstanceEntity,
  WorkflowTransitionEntity,
  DashboardMetrics,
} from '../entities/workflow.entity.js';
import { LEVEL_ROLES, LEVEL_ORDER } from '../entities/workflow.entity.js';
import type { CreateInstanceInput } from '../schemas/workflow.schemas.js';

const SERVICE_NAME = 'workflow-service';

/** Lightweight HTTP error for Fastify error handler */
export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Cached definition + steps for a tenant */
interface DefinitionWithSteps {
  definition: {
    id: string;
    tenant_id: string;
    auto_transmit_enabled: boolean;
    auto_validate_enabled: boolean;
    require_comment: boolean;
    allow_reject: boolean;
    allow_return: boolean;
    default_validation_delay: number;
    default_transmit_delay: number;
    is_active: boolean;
    [key: string]: unknown;
  };
  steps: Array<{
    id: string;
    step_order: number;
    level_type: string;
    can_edit: boolean;
    can_validate: boolean;
    transmit_delay_hours: number | null;
    [key: string]: unknown;
  }>;
  /** Ordered level_type sequence derived from steps */
  levelOrder: string[];
}

export class WorkflowService {
  /** In-memory cache: tenantId → definition+steps (TTL managed by simple expiry) */
  private definitionCache = new Map<string, { data: DefinitionWithSteps | null; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly kafkaProducer: StandaloneKafkaProducer,
    private readonly eventPublisher?: { publish: (...args: any[]) => Promise<void> },
  ) {}

  // ── Create ──

  async create(
    dto: CreateInstanceInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    // Determine start level from definition or fall back to NATIONAL_TECHNICAL
    const VALID_LEVELS = new Set(LEVEL_ORDER);
    const def = await this.getDefinitionWithSteps(user.tenantId);
    const defStartLevel = def && def.levelOrder.length > 0 ? def.levelOrder[0] : null;
    const startLevel = defStartLevel && VALID_LEVELS.has(defStartLevel)
      ? defStartLevel
      : 'NATIONAL_TECHNICAL';

    const instance = await (this.prisma as any).workflowInstance.create({
      data: {
        tenant_id: user.tenantId,
        entity_type: dto.entityType,
        entity_id: dto.entityId,
        domain: dto.domain,
        current_level: startLevel,
        status: 'PENDING',
        data_contract_id: dto.dataContractId ?? null,
        quality_report_id: dto.qualityReportId ?? null,
        created_by: user.userId,
      },
    });

    // Set campaign_id via raw SQL (Prisma client may not have the column in its generated types yet)
    if (dto.campaignId) {
      await (this.prisma as any).$executeRawUnsafe(
        `UPDATE workflow.workflow_instances SET campaign_id = $1::uuid WHERE id = $2::uuid`,
        dto.campaignId,
        instance.id,
      );
      instance.campaign_id = dto.campaignId;
    }

    // Task 3: SLA deadline auto-population from WorkflowDefinition
    const updatedInstance = await this.applySlaDeadline(instance, user.tenantId);

    await this.publishEvent(
      TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
      updatedInstance,
      user,
    );

    return { data: this.toEntity(updatedInstance) };
  }

  // ── List ──

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & {
      level?: string;
      status?: string;
      domain?: string;
      entityId?: string;
      campaignId?: string;
    },
  ): Promise<PaginatedResponse<WorkflowInstanceEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { created_at: 'desc' as const };

    const where: Prisma.WorkflowInstanceWhereInput = {
      ...this.buildTenantFilter(user),
      ...(query.level && { current_level: query.level as Prisma.EnumWfLevelFilter }),
      ...(query.status && { status: query.status as Prisma.EnumWfStatusFilter }),
      ...(query.domain && { domain: query.domain }),
      ...(query.entityId && { entity_id: query.entityId }),
    };

    // campaign_id filter via raw SQL (column added via migration, not in Prisma generated types)
    if (query.campaignId) {
      const ids: Array<{ id: string }> = await (this.prisma as any).$queryRawUnsafe(
        `SELECT id FROM workflow.workflow_instances WHERE campaign_id = $1::uuid`,
        query.campaignId,
      );
      (where as any).id = { in: ids.map(r => r.id) };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).workflowInstance.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).workflowInstance.count({ where }),
    ]);

    return {
      data: data.map((i: any) => this.toEntity(i)),
      meta: { total, page, limit },
    };
  }

  // ── Get with transitions ──

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
      include: { transitions: { orderBy: { created_at: 'asc' } } },
    });

    if (!instance) {
      throw new HttpError(404, `Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);

    return { data: this.toEntityWithTransitions(instance) };
  }

  // ── Approve ──

  async approve(
    id: string,
    comment: string | undefined,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new HttpError(404, `Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    // Fetch dynamic definition for the tenant
    const def = await this.getDefinitionWithSteps(instance.tenant_id);

    // Enforce require_comment if definition mandates it
    if (def && def.definition.require_comment && (!comment || comment.trim().length === 0)) {
      throw new HttpError(400, 'Comment is required for approval in this workflow configuration');
    }

    // Determine level sequence (dynamic or hardcoded fallback)
    const levelOrder = def ? def.levelOrder : [...LEVEL_ORDER];
    const currentLevelIdx = levelOrder.indexOf(instance.current_level);
    const isLastLevel = currentLevelIdx === levelOrder.length - 1;
    const nextLevel = isLastLevel
      ? instance.current_level
      : levelOrder[currentLevelIdx + 1];

    // Task 4: Validation chain advisory — suggest validator for the next level
    let transitionComment = comment ?? null;
    if (!isLastLevel) {
      try {
        const chain = await (this.prisma as any).validationChain.findFirst({
          where: {
            user_id: instance.created_by,
            level_type: nextLevel,
          },
        });
        if (chain) {
          const advisory = ` [Suggested validator: ${chain.validator_id}]`;
          transitionComment = transitionComment
            ? transitionComment + advisory
            : advisory;
        }
      } catch {
        // Non-critical — proceed without advisory
      }
    }

    // Determine new status and flags
    const nextStatus = isLastLevel ? 'APPROVED' : 'PENDING';
    const wahisReady =
      instance.wahis_ready ||
      instance.current_level === 'NATIONAL_OFFICIAL';
    const analyticsReady =
      instance.analytics_ready ||
      instance.current_level === 'CONTINENTAL_PUBLICATION';

    const [updated] = await (this.prisma as any).$transaction([
      (this.prisma as any).workflowInstance.update({
        where: { id },
        data: {
          current_level: nextLevel as Prisma.EnumWfLevelFieldUpdateOperationsInput['set'],
          status: nextStatus as Prisma.EnumWfStatusFieldUpdateOperationsInput['set'],
          wahis_ready: wahisReady,
          analytics_ready: analyticsReady,
        },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      }),
      (this.prisma as any).workflowTransition.create({
        data: {
          instance_id: id,
          from_level: instance.current_level,
          to_level: nextLevel,
          from_status: instance.status,
          to_status: nextStatus,
          action: 'APPROVE',
          actor_user_id: user.userId,
          actor_role: user.role,
          comment: transitionComment,
        },
      }),
    ]);

    // Task 3: Reset SLA deadline for the next level (not on final approval)
    if (!isLastLevel) {
      // Check for step-level transmit_delay_hours override
      const nextStepDelay = def
        ? this.findStep(def, nextLevel as string)?.transmit_delay_hours ?? undefined
        : undefined;
      await this.applySlaDeadline(updated, instance.tenant_id, nextStepDelay);
    }

    // Auto-validate: if the next step has auto_validate_enabled and quality gates passed,
    // recursively approve through that step without manual intervention
    if (!isLastLevel && def && def.definition.auto_validate_enabled) {
      const nextStep = this.findStep(def, nextLevel as string);
      if (nextStep && updated.quality_report_id) {
        // Auto-advance through the next level
        try {
          const systemUser: AuthenticatedUser = {
            userId: '00000000-0000-0000-0000-000000000000',
            role: 'SUPER_ADMIN' as any,
            roles: ['SUPER_ADMIN'],
            tenantId: instance.tenant_id,
            tenantLevel: TenantLevel.CONTINENTAL,
            email: 'system@au-aris.org',
            domains: {},
          };
          await this.approve(updated.id, `Auto-validated: quality gates passed`, systemUser);
        } catch {
          // Non-critical — manual validation still possible
        }
      }
    }

    // Publish approval event
    await this.publishEvent(TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, updated, user);

    // Publish WAHIS ready event when Level 2 approved
    if (instance.current_level === 'NATIONAL_OFFICIAL' && !instance.wahis_ready) {
      await this.publishEvent(TOPIC_AU_WORKFLOW_WAHIS_READY, updated, user);
      await this.publishFlagReadyEvent(instance, 'wahisReady', user);
    }

    // Publish analytics ready event when Level 4 approved
    if (instance.current_level === 'CONTINENTAL_PUBLICATION' && !instance.analytics_ready) {
      await this.publishEvent(TOPIC_AU_WORKFLOW_ANALYTICS_READY, updated, user);
      await this.publishFlagReadyEvent(instance, 'analyticsReady', user);
    }

    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Reject ──

  async reject(
    id: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new HttpError(404, `Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    // Check if rejection is allowed by workflow definition
    const def = await this.getDefinitionWithSteps(instance.tenant_id);
    if (def && !def.definition.allow_reject) {
      throw new HttpError(400, 'Rejection is not allowed in this workflow configuration');
    }

    const [updated] = await (this.prisma as any).$transaction([
      (this.prisma as any).workflowInstance.update({
        where: { id },
        data: { status: 'REJECTED' },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      }),
      (this.prisma as any).workflowTransition.create({
        data: {
          instance_id: id,
          from_level: instance.current_level,
          to_level: instance.current_level,
          from_status: instance.status,
          to_status: 'REJECTED',
          action: 'REJECT',
          actor_user_id: user.userId,
          actor_role: user.role,
          comment: reason,
        },
      }),
    ]);

    await this.publishEvent(TOPIC_AU_WORKFLOW_VALIDATION_REJECTED, updated, user);

    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Return ──

  async returnForCorrection(
    id: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new HttpError(404, `Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    // Check if return is allowed by workflow definition
    const def = await this.getDefinitionWithSteps(instance.tenant_id);
    if (def && !def.definition.allow_return) {
      throw new HttpError(400, 'Return for correction is not allowed in this workflow configuration');
    }

    // Return drops back one level (or stays at level 1) — use dynamic level order
    const levelOrder = def ? def.levelOrder : [...LEVEL_ORDER];
    const currentIdx = levelOrder.indexOf(instance.current_level);
    const previousLevel = currentIdx > 0
      ? levelOrder[currentIdx - 1]
      : levelOrder[0];

    const [updated] = await (this.prisma as any).$transaction([
      (this.prisma as any).workflowInstance.update({
        where: { id },
        data: {
          current_level: previousLevel as Prisma.EnumWfLevelFieldUpdateOperationsInput['set'],
          status: 'RETURNED',
        },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      }),
      (this.prisma as any).workflowTransition.create({
        data: {
          instance_id: id,
          from_level: instance.current_level,
          to_level: previousLevel,
          from_status: instance.status,
          to_status: 'RETURNED',
          action: 'RETURN',
          actor_user_id: user.userId,
          actor_role: user.role,
          comment: reason,
        },
      }),
    ]);

    await this.publishEvent(TOPIC_AU_WORKFLOW_VALIDATION_RETURNED, updated, user);

    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Bulk Action ──

  async bulkAction(
    dto: { ids: string[]; action: string; comment?: string },
    user: AuthenticatedUser,
  ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
    const succeeded: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of dto.ids) {
      try {
        if (dto.action === 'APPROVE') {
          await this.approve(id, dto.comment ?? undefined, user);
        } else if (dto.action === 'REJECT') {
          await this.reject(id, dto.comment ?? 'Bulk rejected', user);
        } else if (dto.action === 'RETURN') {
          await this.returnForCorrection(id, dto.comment ?? 'Returned for correction', user);
        }
        succeeded.push(id);
      } catch (err: any) {
        failed.push({ id, error: err.message ?? 'Unknown error' });
      }
    }

    return { succeeded, failed };
  }

  // ── Comment ──

  async addComment(
    id: string,
    text: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new HttpError(404, `Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    // Create a COMMENT transition — same from/to level and status (no state change)
    await (this.prisma as any).workflowTransition.create({
      data: {
        instance_id: id,
        from_level: instance.current_level,
        to_level: instance.current_level,
        from_status: instance.status,
        to_status: instance.status,
        action: 'COMMENT',
        actor_user_id: user.userId,
        actor_role: user.role,
        comment: text,
      },
    });

    const updated = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
      include: { transitions: { orderBy: { created_at: 'asc' } } },
    });

    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Escalate (called by EscalationService) ──

  async escalate(
    id: string,
    reason: string,
  ): Promise<void> {
    const instance = await (this.prisma as any).workflowInstance.findUnique({
      where: { id },
    });

    if (!instance || instance.status === 'APPROVED' || instance.status === 'REJECTED') {
      return;
    }

    // Use dynamic level order for escalation
    const levelOrder = await this.getLevelOrder(instance.tenant_id);
    const currentIdx = levelOrder.indexOf(instance.current_level);
    const nextLevel = currentIdx < levelOrder.length - 1
      ? levelOrder[currentIdx + 1]
      : instance.current_level;

    await (this.prisma as any).$transaction([
      (this.prisma as any).workflowInstance.update({
        where: { id },
        data: {
          current_level: nextLevel as Prisma.EnumWfLevelFieldUpdateOperationsInput['set'],
          status: 'ESCALATED',
        },
      }),
      (this.prisma as any).workflowTransition.create({
        data: {
          instance_id: id,
          from_level: instance.current_level,
          to_level: nextLevel,
          from_status: instance.status,
          to_status: 'ESCALATED',
          action: 'ESCALATE',
          actor_user_id: '00000000-0000-0000-0000-000000000000',
          actor_role: 'SYSTEM',
          comment: reason,
        },
      }),
    ]);

    const headers: KafkaHeaders = {
      correlationId: uuidv4(),
      sourceService: SERVICE_NAME,
      tenantId: instance.tenant_id,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaProducer.send(
        TOPIC_AU_WORKFLOW_VALIDATION_ESCALATED,
        instance.id,
        { instanceId: instance.id, entityType: instance.entity_type, entityId: instance.entity_id, domain: instance.domain, tenantId: instance.tenant_id, campaignId: instance.campaign_id, fromLevel: instance.current_level, toLevel: nextLevel, reason },
        headers,
      );
    } catch (error) {
      // Log but don't throw — escalation DB changes are committed
    }
  }

  // ── Dashboard ──

  async getDashboard(
    user: AuthenticatedUser,
  ): Promise<ApiResponse<DashboardMetrics>> {
    const tenantFilter = this.buildTenantFilter(user);

    const [
      pendingTech,
      pendingOfficial,
      pendingRec,
      pendingCont,
      totalInReview,
      totalApproved,
      totalRejected,
      totalEscalated,
      slaBreaches,
      wahisReadyCount,
      analyticsReadyCount,
    ] = await Promise.all([
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, current_level: 'NATIONAL_TECHNICAL', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, current_level: 'NATIONAL_OFFICIAL', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, current_level: 'REC_HARMONIZATION', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, current_level: 'CONTINENTAL_PUBLICATION', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, status: 'IN_REVIEW' } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, status: 'APPROVED' } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, status: 'REJECTED' } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, status: 'ESCALATED' } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, sla_deadline: { lt: new Date() }, status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED', 'ESCALATED'] } } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, wahis_ready: true } }),
      (this.prisma as any).workflowInstance.count({ where: { ...tenantFilter, analytics_ready: true } }),
    ]);

    return {
      data: {
        pendingByLevel: {
          NATIONAL_TECHNICAL: pendingTech,
          NATIONAL_OFFICIAL: pendingOfficial,
          REC_HARMONIZATION: pendingRec,
          CONTINENTAL_PUBLICATION: pendingCont,
        },
        totalPending: pendingTech + pendingOfficial + pendingRec + pendingCont,
        totalInReview,
        totalApproved,
        totalRejected,
        totalEscalated,
        slaBreaches,
        wahisReadyCount,
        analyticsReadyCount,
      },
    };
  }

  // ── Domain Service Callbacks ──

  private async publishFlagReadyEvent(
    instance: { entity_type: string; entity_id: string; domain: string; id: string },
    flag: 'wahisReady' | 'analyticsReady',
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!this.eventPublisher) return;

    const topic =
      flag === 'wahisReady'
        ? 'au.workflow.wahis.ready.v1'
        : 'au.workflow.analytics.ready.v1';

    try {
      await this.eventPublisher.publish(topic, {
        eventType: topic,
        source: SERVICE_NAME,
        version: 1,
        tenantId: user.tenantId,
        userId: user.userId,
        payload: {
          instanceId: instance.id,
          entityType: instance.entity_type,
          entityId: instance.entity_id,
          domain: instance.domain, // Backward compat: reads legacy domain field, prefer targets[]
          flag,
        },
      }, { key: instance.entity_id });
    } catch {
      // Log but don't throw — approval is already committed
    }
  }

  /**
   * Auto-advance a workflow instance when quality gates pass.
   * Originally Level 1 only (NATIONAL_TECHNICAL), now supports any level
   * that has auto_validate_enabled in the workflow definition.
   *
   * Called when au.quality.record.validated.v1 is received — quality passed means
   * technical validation is automatically approved.
   */
  async autoAdvanceLevel1(
    entityId: string,
    qualityReportId: string,
  ): Promise<void> {
    // Find any pending instance for this entity (not just NATIONAL_TECHNICAL)
    const instance = await (this.prisma as any).workflowInstance.findFirst({
      where: {
        entity_id: entityId,
        status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] },
      },
    });

    if (!instance) {
      return;
    }

    // Determine which level to auto-advance and the next level
    const def = await this.getDefinitionWithSteps(instance.tenant_id);
    const levelOrder = def ? def.levelOrder : [...LEVEL_ORDER];

    const currentIdx = levelOrder.indexOf(instance.current_level);
    if (currentIdx === -1 || currentIdx >= levelOrder.length - 1) {
      // Unknown level or already at final level — skip auto-advance
      return;
    }

    // Check if auto-validate is enabled: either the definition-level flag
    // or the original L1 auto-advance behavior (always allowed for NATIONAL_TECHNICAL)
    const isLevel1 = instance.current_level === 'NATIONAL_TECHNICAL';
    const defAutoValidate = def?.definition.auto_validate_enabled ?? false;

    if (!isLevel1 && !defAutoValidate) {
      // Only auto-advance L1 by default; other levels need explicit auto_validate_enabled
      return;
    }

    const nextLevel = levelOrder[currentIdx + 1];

    await (this.prisma as any).$transaction([
      (this.prisma as any).workflowInstance.update({
        where: { id: instance.id },
        data: {
          current_level: nextLevel,
          status: 'PENDING',
          quality_report_id: qualityReportId,
        },
      }),
      (this.prisma as any).workflowTransition.create({
        data: {
          instance_id: instance.id,
          from_level: instance.current_level,
          to_level: nextLevel,
          from_status: instance.status,
          to_status: 'PENDING',
          action: 'APPROVE',
          actor_user_id: '00000000-0000-0000-0000-000000000000', // SYSTEM
          actor_role: 'SYSTEM',
          comment: `Auto-approved: quality gates passed (report: ${qualityReportId})`,
        },
      }),
    ]);

    // If the next level also has auto_validate_enabled and quality gates passed,
    // recursively auto-advance
    if (defAutoValidate) {
      await this.autoAdvanceLevel1(entityId, qualityReportId);
    }
  }

  // ── SLA Deadline Helper ──

  /**
   * Look up WorkflowDefinition for tenant; if delay > 0, set sla_deadline.
   * Priority: stepDelayHours (step-level override) > definition default_validation_delay.
   * Returns the (possibly updated) instance.
   */
  private async applySlaDeadline(
    instance: { id: string; [key: string]: unknown },
    tenantId: string,
    stepDelayHours?: number,
  ): Promise<any> {
    try {
      // Use step-level delay if provided, otherwise look up definition default
      let delayHours = stepDelayHours;

      if (delayHours === undefined || delayHours === null) {
        const def = await this.getDefinitionWithSteps(tenantId);
        delayHours = def ? def.definition.default_validation_delay : 0;
      }

      if (delayHours && delayHours > 0) {
        const deadline = new Date(
          Date.now() + delayHours * 3_600_000,
        );
        return await (this.prisma as any).workflowInstance.update({
          where: { id: instance.id },
          data: { sla_deadline: deadline },
          include: { transitions: { orderBy: { created_at: 'asc' } } },
        });
      }
    } catch {
      // Non-critical — instance continues without SLA deadline
    }
    return instance;
  }

  // ── Definition Helpers ──

  /**
   * Fetch and cache the active WorkflowDefinition + ordered steps for a tenant.
   * Returns null if no definition exists — callers fall back to hardcoded defaults.
   */
  private async getDefinitionWithSteps(tenantId: string): Promise<DefinitionWithSteps | null> {
    const cached = this.definitionCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const definition = await (this.prisma as any).workflowDefinition.findFirst({
        where: { tenant_id: tenantId, is_active: true },
        include: { steps: { orderBy: { step_order: 'asc' } } },
      });

      if (!definition || !definition.steps || definition.steps.length === 0) {
        this.definitionCache.set(tenantId, { data: null, expiresAt: Date.now() + WorkflowService.CACHE_TTL_MS });
        return null;
      }

      const result: DefinitionWithSteps = {
        definition,
        steps: definition.steps,
        levelOrder: definition.steps.map((s: any) => s.level_type),
      };

      this.definitionCache.set(tenantId, { data: result, expiresAt: Date.now() + WorkflowService.CACHE_TTL_MS });
      return result;
    } catch {
      // Non-critical — fall back to hardcoded defaults
      return null;
    }
  }

  /**
   * Get the ordered level sequence for a tenant.
   * Uses dynamic definition steps if available, otherwise hardcoded LEVEL_ORDER.
   */
  private async getLevelOrder(tenantId: string): Promise<readonly string[]> {
    const VALID_LEVELS = new Set(LEVEL_ORDER);
    const def = await this.getDefinitionWithSteps(tenantId);
    if (!def) return LEVEL_ORDER;
    // Filter to only valid enum values — definition steps may have legacy level_type values
    const validDefLevels = def.levelOrder.filter(l => VALID_LEVELS.has(l));
    return validDefLevels.length > 0 ? validDefLevels : LEVEL_ORDER;
  }

  /**
   * Find the step config for a given level_type within the definition.
   */
  private findStep(def: DefinitionWithSteps, levelType: string): DefinitionWithSteps['steps'][number] | undefined {
    return def.steps.find((s) => s.level_type === levelType);
  }

  // ── RBAC Checks ──

  verifyRoleForLevel(user: AuthenticatedUser, level: string): void {
    const allowedRoles = LEVEL_ROLES[level];
    if (!allowedRoles) {
      throw new HttpError(400, `Unknown workflow level: ${level}`);
    }
    if (!allowedRoles.includes(user.role)) {
      throw new HttpError(
        403,
        `Role ${user.role} cannot act at workflow level ${level}`,
      );
    }
  }

  private verifyActionable(status: string): void {
    const actionable = ['PENDING', 'IN_REVIEW', 'RETURNED', 'ESCALATED'];
    if (!actionable.includes(status)) {
      throw new HttpError(
        400,
        `Cannot transition workflow in status ${status}. Must be one of: ${actionable.join(', ')}`,
      );
    }
  }

  // ── Tenant Filtering ──

  private buildTenantFilter(
    user: AuthenticatedUser,
  ): Prisma.WorkflowInstanceWhereInput {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};
      case TenantLevel.REC:
        return {
          OR: [
            { tenant_id: user.tenantId },
          ],
        };
      case TenantLevel.MEMBER_STATE:
        return { tenant_id: user.tenantId };
      default:
        return { tenant_id: user.tenantId };
    }
  }

  private verifyTenantAccess(
    user: AuthenticatedUser,
    instanceTenantId: string,
  ): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) {
      return;
    }
    if (instanceTenantId === user.tenantId) {
      return;
    }
    throw new HttpError(404, 'Workflow instance not found');
  }

  // ── Kafka Events ──

  private async publishEvent(
    topic: string,
    instance: { id: string; [key: string]: unknown },
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

    try {
      await this.kafkaProducer.send(topic, instance.id as string, instance, headers);
    } catch {
      // Log but don't throw — DB changes are committed
    }
  }

  // ── Mapping ──

  toEntity(row: {
    id: string;
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    domain: string;
    campaign_id?: string | null;
    current_level: string;
    status: string;
    data_contract_id: string | null;
    quality_report_id: string | null;
    wahis_ready: boolean;
    analytics_ready: boolean;
    sla_deadline: Date | null;
    created_by: string;
    created_at: Date;
    updated_at: Date;
  }): WorkflowInstanceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      domain: row.domain, // Backward compat: reads legacy domain field, prefer targets[]
      campaignId: row.campaign_id ?? null,
      currentLevel: row.current_level as WorkflowLevel,
      status: row.status,
      dataContractId: row.data_contract_id,
      qualityReportId: row.quality_report_id,
      wahisReady: row.wahis_ready,
      analyticsReady: row.analytics_ready,
      slaDeadline: row.sla_deadline,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toEntityWithTransitions(row: {
    id: string;
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    domain: string;
    campaign_id?: string | null;
    current_level: string;
    status: string;
    data_contract_id: string | null;
    quality_report_id: string | null;
    wahis_ready: boolean;
    analytics_ready: boolean;
    sla_deadline: Date | null;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    transitions: Array<{
      id: string;
      instance_id: string;
      from_level: string;
      to_level: string;
      from_status: string;
      to_status: string;
      action: string;
      actor_user_id: string;
      actor_role: string;
      comment: string | null;
      created_at: Date;
    }>;
  }): WorkflowInstanceEntity {
    const entity = this.toEntity(row);
    entity.transitions = row.transitions.map((t) => ({
      id: t.id,
      instanceId: t.instance_id,
      fromLevel: t.from_level as WorkflowLevel,
      toLevel: t.to_level as WorkflowLevel,
      fromStatus: t.from_status,
      toStatus: t.to_status,
      action: t.action as WorkflowTransitionEntity['action'],
      actorUserId: t.actor_user_id,
      actorRole: t.actor_role as UserRole,
      comment: t.comment,
      createdAt: t.created_at,
    }));
    return entity;
  }
}
