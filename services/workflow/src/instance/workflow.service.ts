import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { KafkaProducerService } from '@aris/kafka-client';
import {
  TenantLevel,
  WorkflowLevel,
  UserRole,
  TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
  TOPIC_AU_WORKFLOW_VALIDATION_APPROVED,
  TOPIC_AU_WORKFLOW_VALIDATION_REJECTED,
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
import { PrismaService } from '../prisma.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import type {
  WorkflowInstanceEntity,
  WorkflowTransitionEntity,
  DashboardMetrics,
} from './entities/workflow.entity';
import { LEVEL_ROLES, LEVEL_ORDER } from './entities/workflow.entity';

const SERVICE_NAME = 'workflow-service';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  // ── Create ──

  async create(
    dto: CreateInstanceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await this.prisma.workflowInstance.create({
      data: {
        tenant_id: user.tenantId,
        entity_type: dto.entityType,
        entity_id: dto.entityId,
        domain: dto.domain,
        current_level: 'NATIONAL_TECHNICAL',
        status: 'PENDING',
        data_contract_id: dto.dataContractId ?? null,
        quality_report_id: dto.qualityReportId ?? null,
        created_by: user.userId,
      },
    });

    await this.publishEvent(
      TOPIC_AU_WORKFLOW_VALIDATION_SUBMITTED,
      instance,
      user,
    );

    this.logger.log(
      `Workflow created: ${instance.entity_type}/${instance.entity_id} (${instance.id})`,
    );
    return { data: this.toEntity(instance) };
  }

  // ── List ──

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery & {
      level?: string;
      status?: string;
      domain?: string;
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
    };

    const [data, total] = await Promise.all([
      this.prisma.workflowInstance.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.workflowInstance.count({ where }),
    ]);

    return {
      data: data.map((i) => this.toEntity(i)),
      meta: { total, page, limit },
    };
  }

  // ── Get with transitions ──

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
      include: { transitions: { orderBy: { created_at: 'asc' } } },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${id} not found`);
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
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    const currentLevelIdx = LEVEL_ORDER.indexOf(instance.current_level);
    const isLastLevel = currentLevelIdx === LEVEL_ORDER.length - 1;
    const nextLevel = isLastLevel
      ? instance.current_level
      : LEVEL_ORDER[currentLevelIdx + 1];

    // Determine new status and flags
    const nextStatus = isLastLevel ? 'APPROVED' : 'PENDING';
    const wahisReady =
      instance.wahis_ready ||
      instance.current_level === 'NATIONAL_OFFICIAL';
    const analyticsReady =
      instance.analytics_ready ||
      instance.current_level === 'CONTINENTAL_PUBLICATION';

    const [updated] = await this.prisma.$transaction([
      this.prisma.workflowInstance.update({
        where: { id },
        data: {
          current_level: nextLevel as Prisma.EnumWfLevelFieldUpdateOperationsInput['set'],
          status: nextStatus as Prisma.EnumWfStatusFieldUpdateOperationsInput['set'],
          wahis_ready: wahisReady,
          analytics_ready: analyticsReady,
        },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      }),
      this.prisma.workflowTransition.create({
        data: {
          instance_id: id,
          from_level: instance.current_level,
          to_level: nextLevel,
          from_status: instance.status,
          to_status: nextStatus,
          action: 'APPROVE',
          actor_user_id: user.userId,
          actor_role: user.role,
          comment: comment ?? null,
        },
      }),
    ]);

    // Publish approval event
    await this.publishEvent(TOPIC_AU_WORKFLOW_VALIDATION_APPROVED, updated, user);

    // Publish WAHIS ready when Level 2 approved
    if (instance.current_level === 'NATIONAL_OFFICIAL' && !instance.wahis_ready) {
      await this.publishEvent(TOPIC_AU_WORKFLOW_WAHIS_READY, updated, user);
      this.logger.log(`WAHIS ready: ${instance.entity_type}/${instance.entity_id}`);
    }

    // Publish analytics ready when Level 4 approved
    if (instance.current_level === 'CONTINENTAL_PUBLICATION' && !instance.analytics_ready) {
      await this.publishEvent(TOPIC_AU_WORKFLOW_ANALYTICS_READY, updated, user);
      this.logger.log(`Analytics ready: ${instance.entity_type}/${instance.entity_id}`);
    }

    this.logger.log(
      `Workflow approved: ${instance.id} level ${instance.current_level} → ${nextLevel}`,
    );
    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Reject ──

  async reject(
    id: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    const [updated] = await this.prisma.$transaction([
      this.prisma.workflowInstance.update({
        where: { id },
        data: { status: 'REJECTED' },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      }),
      this.prisma.workflowTransition.create({
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

    this.logger.log(`Workflow rejected: ${instance.id} at level ${instance.current_level}`);
    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Return ──

  async returnForCorrection(
    id: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowInstanceEntity>> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${id} not found`);
    }

    this.verifyTenantAccess(user, instance.tenant_id);
    this.verifyActionable(instance.status);
    this.verifyRoleForLevel(user, instance.current_level);

    // Return drops back one level (or stays at level 1)
    const currentIdx = LEVEL_ORDER.indexOf(instance.current_level);
    const previousLevel = currentIdx > 0
      ? LEVEL_ORDER[currentIdx - 1]
      : LEVEL_ORDER[0];

    const [updated] = await this.prisma.$transaction([
      this.prisma.workflowInstance.update({
        where: { id },
        data: {
          current_level: previousLevel as Prisma.EnumWfLevelFieldUpdateOperationsInput['set'],
          status: 'RETURNED',
        },
        include: { transitions: { orderBy: { created_at: 'asc' } } },
      }),
      this.prisma.workflowTransition.create({
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

    this.logger.log(
      `Workflow returned: ${instance.id} from ${instance.current_level} → ${previousLevel}`,
    );
    return { data: this.toEntityWithTransitions(updated) };
  }

  // ── Escalate (called by EscalationService) ──

  async escalate(
    id: string,
    reason: string,
  ): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
    });

    if (!instance || instance.status === 'APPROVED' || instance.status === 'REJECTED') {
      return;
    }

    const currentIdx = LEVEL_ORDER.indexOf(instance.current_level);
    const nextLevel = currentIdx < LEVEL_ORDER.length - 1
      ? LEVEL_ORDER[currentIdx + 1]
      : instance.current_level;

    await this.prisma.$transaction([
      this.prisma.workflowInstance.update({
        where: { id },
        data: {
          current_level: nextLevel as Prisma.EnumWfLevelFieldUpdateOperationsInput['set'],
          status: 'ESCALATED',
        },
      }),
      this.prisma.workflowTransition.create({
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
        { instanceId: instance.id, entityType: instance.entity_type, entityId: instance.entity_id, fromLevel: instance.current_level, toLevel: nextLevel, reason },
        headers,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish escalation for ${instance.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    this.logger.warn(
      `Workflow escalated: ${instance.id} from ${instance.current_level} → ${nextLevel}: ${reason}`,
    );
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
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, current_level: 'NATIONAL_TECHNICAL', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, current_level: 'NATIONAL_OFFICIAL', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, current_level: 'REC_HARMONIZATION', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, current_level: 'CONTINENTAL_PUBLICATION', status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED'] } } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, status: 'IN_REVIEW' } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, status: 'APPROVED' } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, status: 'REJECTED' } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, status: 'ESCALATED' } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, sla_deadline: { lt: new Date() }, status: { in: ['PENDING', 'IN_REVIEW', 'RETURNED', 'ESCALATED'] } } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, wahis_ready: true } }),
      this.prisma.workflowInstance.count({ where: { ...tenantFilter, analytics_ready: true } }),
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

  // ── RBAC Checks ──

  /**
   * Verify the user's role is authorized to act at the given workflow level.
   */
  verifyRoleForLevel(user: AuthenticatedUser, level: string): void {
    const allowedRoles = LEVEL_ROLES[level];
    if (!allowedRoles) {
      throw new BadRequestException(`Unknown workflow level: ${level}`);
    }
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${user.role} cannot act at workflow level ${level}`,
      );
    }
  }

  /**
   * Verify the instance is in an actionable status.
   */
  private verifyActionable(status: string): void {
    const actionable = ['PENDING', 'IN_REVIEW', 'RETURNED', 'ESCALATED'];
    if (!actionable.includes(status)) {
      throw new BadRequestException(
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
    throw new NotFoundException('Workflow instance not found');
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
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} for instance ${instance.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Mapping ──

  toEntity(row: {
    id: string;
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    domain: string;
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
      domain: row.domain,
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
