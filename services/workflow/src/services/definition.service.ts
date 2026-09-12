import type { PrismaClient } from '@prisma/client';
import {
  TenantLevel,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@aris/shared-types';
import type {
  PaginationQuery,
  PaginatedResponse,
  ApiResponse,
} from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type {
  WorkflowDefinitionEntity,
  WorkflowStepEntity,
} from '../entities/workflow.entity.js';
import type {
  CreateDefinitionInput,
  UpdateDefinitionInput,
  CreateStepInput,
  UpdateStepInput,
} from '../schemas/definition.schemas.js';
import { HttpError } from './workflow.service.js';
import { randomUUID } from 'node:crypto';

export class DefinitionService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Create ──

  async create(
    dto: CreateDefinitionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowDefinitionEntity>> {
    const row = await (this.prisma as any).workflowDefinition.create({
      data: {
        tenant_id: user.tenantId,
        country_code: dto.countryCode.toUpperCase(),
        name: dto.name,
        description: dto.description ?? null,
        start_level: dto.startLevel ?? 5,
        end_level: dto.endLevel ?? 0,
        default_transmit_delay: dto.defaultTransmitDelay ?? 72,
        default_validation_delay: dto.defaultValidationDelay ?? 48,
        auto_transmit_enabled: dto.autoTransmitEnabled ?? true,
        auto_validate_enabled: dto.autoValidateEnabled ?? false,
        require_comment: dto.requireComment ?? false,
        allow_reject: dto.allowReject ?? true,
        allow_return: dto.allowReturn ?? true,
        created_by: user.userId,
      },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    return { data: this.toEntity(row) };
  }

  // ── List ──

  async findAll(
    user: AuthenticatedUser,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<WorkflowDefinitionEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : { created_at: 'desc' as const };

    const where = this.buildTenantFilter(user);

    const [data, total] = await Promise.all([
      (this.prisma as any).workflowDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { steps: { orderBy: { step_order: 'asc' } } },
      }),
      (this.prisma as any).workflowDefinition.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  // ── Get one ──

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowDefinitionEntity>> {
    const row = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id },
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    if (!row) {
      throw new HttpError(404, `Workflow definition ${id} not found`);
    }

    this.verifyTenantAccess(user, row.tenant_id);

    return { data: this.toEntity(row) };
  }

  // ── Get by country ──

  async findByCountry(
    code: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowDefinitionEntity>> {
    const where: any = {
      country_code: code.toUpperCase(),
      ...this.buildTenantFilter(user),
    };

    const row = await (this.prisma as any).workflowDefinition.findFirst({
      where,
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    if (!row) {
      throw new HttpError(404, `Workflow definition for country ${code} not found`);
    }

    return { data: this.toEntity(row) };
  }

  // ── Update ──

  async update(
    id: string,
    dto: UpdateDefinitionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowDefinitionEntity>> {
    const existing = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, `Workflow definition ${id} not found`);
    }

    this.verifyTenantAccess(user, existing.tenant_id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.startLevel !== undefined) data.start_level = dto.startLevel;
    if (dto.endLevel !== undefined) data.end_level = dto.endLevel;
    if (dto.defaultTransmitDelay !== undefined) data.default_transmit_delay = dto.defaultTransmitDelay;
    if (dto.defaultValidationDelay !== undefined) data.default_validation_delay = dto.defaultValidationDelay;
    if (dto.autoTransmitEnabled !== undefined) data.auto_transmit_enabled = dto.autoTransmitEnabled;
    if (dto.autoValidateEnabled !== undefined) data.auto_validate_enabled = dto.autoValidateEnabled;
    if (dto.requireComment !== undefined) data.require_comment = dto.requireComment;
    if (dto.allowReject !== undefined) data.allow_reject = dto.allowReject;
    if (dto.allowReturn !== undefined) data.allow_return = dto.allowReturn;
    if (dto.isActive !== undefined) data.is_active = dto.isActive;

    const row = await (this.prisma as any).workflowDefinition.update({
      where: { id },
      data,
      include: { steps: { orderBy: { step_order: 'asc' } } },
    });

    return { data: this.toEntity(row) };
  }

  // ── Steps: Create ──

  async createStep(
    definitionId: string,
    dto: CreateStepInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowStepEntity>> {
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    }

    this.verifyTenantAccess(user, definition.tenant_id);

    const row = await (this.prisma as any).workflowStep.create({
      data: {
        definition_id: definitionId,
        step_order: dto.stepOrder,
        level_type: dto.levelType,
        admin_level: dto.adminLevel ?? null,
        name: dto.name,
        can_edit: dto.canEdit ?? false,
        can_validate: dto.canValidate ?? true,
        transmit_delay_hours: dto.transmitDelayHours ?? null,
      },
    });

    return { data: this.toStepEntity(row) };
  }

  // ── Steps: Update ──

  async updateStep(
    definitionId: string,
    stepId: string,
    dto: UpdateStepInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowStepEntity>> {
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    }

    this.verifyTenantAccess(user, definition.tenant_id);

    const existing = await (this.prisma as any).workflowStep.findFirst({
      where: { id: stepId, definition_id: definitionId },
    });

    if (!existing) {
      throw new HttpError(404, `Workflow step ${stepId} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.stepOrder !== undefined) data.step_order = dto.stepOrder;
    if (dto.levelType !== undefined) data.level_type = dto.levelType;
    if (dto.adminLevel !== undefined) data.admin_level = dto.adminLevel;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.canEdit !== undefined) data.can_edit = dto.canEdit;
    if (dto.canValidate !== undefined) data.can_validate = dto.canValidate;
    if (dto.transmitDelayHours !== undefined) data.transmit_delay_hours = dto.transmitDelayHours;

    const row = await (this.prisma as any).workflowStep.update({
      where: { id: stepId },
      data,
    });

    return { data: this.toStepEntity(row) };
  }

  // ── Steps: Delete ──

  async deleteStep(
    definitionId: string,
    stepId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    }

    this.verifyTenantAccess(user, definition.tenant_id);

    const existing = await (this.prisma as any).workflowStep.findFirst({
      where: { id: stepId, definition_id: definitionId },
    });

    if (!existing) {
      throw new HttpError(404, `Workflow step ${stepId} not found`);
    }

    await (this.prisma as any).workflowStep.delete({ where: { id: stepId } });
  }

  // ══════════════════════════════════════════════════════════════
  //  DAG GRAPH CRUD
  // ══════════════════════════════════════════════════════════════

  /**
   * Get the full graph (steps with positions + edges) for a definition.
   */
  async getGraph(definitionId: string, user: AuthenticatedUser) {
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
          include: {
            outgoing_edges: { orderBy: { sort_order: 'asc' } },
            incoming_edges: true,
          },
        },
        edges: { orderBy: { sort_order: 'asc' } },
      },
    });

    if (!definition) throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    this.verifyTenantAccess(user, definition.tenant_id);

    return {
      data: {
        id: definition.id,
        isDag: definition.is_dag ?? false,
        graphVersion: definition.graph_version ?? 1,
        steps: (definition.steps ?? []).map((s: any) => ({
          id: s.id,
          stepKey: s.step_key,
          stepOrder: s.step_order,
          nodeType: s.node_type ?? 'step',
          levelType: s.level_type,
          adminLevel: s.admin_level,
          name: s.name,
          canEdit: s.can_edit,
          canValidate: s.can_validate,
          mergeStrategy: s.merge_strategy ?? 'ALL',
          allowedRoles: s.allowed_roles,
          transmitDelayHours: s.transmit_delay_hours,
          positionX: s.position_x,
          positionY: s.position_y,
        })),
        edges: (definition.edges ?? []).map((e: any) => ({
          id: e.id,
          sourceStepId: e.source_step_id,
          targetStepId: e.target_step_id,
          edgeType: e.edge_type,
          label: e.label,
          condition: e.condition,
          sortOrder: e.sort_order,
        })),
      },
    };
  }

  /**
   * Save the full graph atomically: diff steps and edges in a single transaction.
   * Supports optimistic concurrency via graphVersion.
   */
  async saveGraph(
    definitionId: string,
    body: {
      graphVersion: number;
      steps: Array<{
        id?: string;
        stepKey: string;
        stepOrder: number;
        nodeType: string;
        levelType?: string;
        adminLevel?: number;
        name: Record<string, string>;
        canEdit?: boolean;
        canValidate?: boolean;
        allowedRoles?: string[];
        mergeStrategy?: string;
        transmitDelayHours?: number;
        positionX?: number;
        positionY?: number;
      }>;
      edges: Array<{
        id?: string;
        sourceStepKey: string;
        targetStepKey: string;
        edgeType: string;
        label?: Record<string, string>;
        condition?: Record<string, unknown>;
        sortOrder?: number;
      }>;
    },
    user: AuthenticatedUser,
  ) {
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    this.verifyTenantAccess(user, definition.tenant_id);

    // Optimistic concurrency check
    if (definition.graph_version !== body.graphVersion) {
      throw new HttpError(409, `Graph version conflict: expected ${definition.graph_version}, got ${body.graphVersion}. Please refresh and try again.`);
    }

    // Validate the graph
    const { validateDAG } = await import('../utils/dag-validator.js');
    const validation = validateDAG(
      body.steps.map((s) => ({ id: s.stepKey, nodeType: s.nodeType, stepKey: s.stepKey })),
      body.edges.map((e) => ({ sourceStepId: e.sourceStepKey, targetStepId: e.targetStepKey, edgeType: e.edgeType })),
    );

    if (!validation.valid) {
      throw new HttpError(400, `Invalid workflow graph: ${validation.errors.join('; ')}`);
    }

    // Build step key→UUID map (reuse existing IDs where possible)
    const existingSteps = await (this.prisma as any).workflowStep.findMany({
      where: { definition_id: definitionId },
    });
    const existingByKey = new Map(existingSteps.map((s: any) => [s.step_key ?? s.id, s]));

    const stepKeyToId = new Map<string, string>();
    const ops: any[] = [];

    // Delete all existing edges first (they reference steps)
    ops.push(
      (this.prisma as any).$executeRawUnsafe(
        `DELETE FROM workflow.workflow_edges WHERE definition_id = $1::uuid`,
        definitionId,
      ),
    );

    // Delete steps that are no longer in the graph
    const newStepKeys = new Set(body.steps.map((s) => s.stepKey));
    for (const existing of existingSteps) {
      const key = existing.step_key ?? existing.id;
      if (!newStepKeys.has(key)) {
        ops.push((this.prisma as any).workflowStep.delete({ where: { id: existing.id } }));
      }
    }

    // Upsert steps
    for (const step of body.steps) {
      const existing = existingByKey.get(step.stepKey);
      const stepId = existing?.id ?? randomUUID();
      stepKeyToId.set(step.stepKey, stepId);

      if (existing) {
        ops.push((this.prisma as any).workflowStep.update({
          where: { id: existing.id },
          data: {
            step_key: step.stepKey,
            step_order: step.stepOrder,
            node_type: step.nodeType,
            level_type: step.levelType ?? step.stepKey,
            admin_level: step.adminLevel ?? null,
            name: step.name,
            can_edit: step.canEdit ?? false,
            can_validate: step.canValidate ?? true,
            allowed_roles: step.allowedRoles ?? null,
            merge_strategy: step.mergeStrategy ?? 'ALL',
            transmit_delay_hours: step.transmitDelayHours ?? null,
            position_x: step.positionX ?? null,
            position_y: step.positionY ?? null,
          },
        }));
      } else {
        ops.push((this.prisma as any).workflowStep.create({
          data: {
            id: stepId,
            definition_id: definitionId,
            step_key: step.stepKey,
            step_order: step.stepOrder,
            node_type: step.nodeType,
            level_type: step.levelType ?? step.stepKey,
            admin_level: step.adminLevel ?? null,
            name: step.name,
            can_edit: step.canEdit ?? false,
            can_validate: step.canValidate ?? true,
            allowed_roles: step.allowedRoles ?? null,
            merge_strategy: step.mergeStrategy ?? 'ALL',
            transmit_delay_hours: step.transmitDelayHours ?? null,
            position_x: step.positionX ?? null,
            position_y: step.positionY ?? null,
          },
        }));
      }
    }

    // Update definition: mark as DAG and increment version
    ops.push((this.prisma as any).workflowDefinition.update({
      where: { id: definitionId },
      data: { is_dag: true, graph_version: definition.graph_version + 1 },
    }));

    // Execute steps first (edges depend on step IDs)
    await (this.prisma as any).$transaction(ops);

    // Now create edges (step IDs are settled)
    const edgeOps: any[] = [];
    for (const edge of body.edges) {
      const sourceId = stepKeyToId.get(edge.sourceStepKey);
      const targetId = stepKeyToId.get(edge.targetStepKey);
      if (!sourceId || !targetId) continue;

      edgeOps.push(
        (this.prisma as any).$executeRawUnsafe(
          `INSERT INTO workflow.workflow_edges (id, definition_id, source_step_id, target_step_id, edge_type, label, condition, sort_order)
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::workflow."WfEdgeType", $5::jsonb, $6::jsonb, $7)`,
          definitionId,
          sourceId,
          targetId,
          edge.edgeType,
          edge.label ? JSON.stringify(edge.label) : null,
          edge.condition ? JSON.stringify(edge.condition) : null,
          edge.sortOrder ?? 0,
        ),
      );
    }

    if (edgeOps.length > 0) {
      await (this.prisma as any).$transaction(edgeOps);
    }

    return this.getGraph(definitionId, user);
  }

  /**
   * Validate a graph without saving. Returns validation errors.
   */
  async validateGraph(
    body: {
      steps: Array<{ stepKey: string; nodeType: string }>;
      edges: Array<{ sourceStepKey: string; targetStepKey: string; edgeType: string }>;
    },
  ) {
    const { validateDAG } = await import('../utils/dag-validator.js');
    const result = validateDAG(
      body.steps.map((s) => ({ id: s.stepKey, nodeType: s.nodeType, stepKey: s.stepKey })),
      body.edges.map((e) => ({ sourceStepId: e.sourceStepKey, targetStepId: e.targetStepKey, edgeType: e.edgeType })),
    );
    return { data: result };
  }

  // ── Tenant Filtering ──

  private buildTenantFilter(user: AuthenticatedUser): Record<string, unknown> {
    switch (user.tenantLevel) {
      case TenantLevel.CONTINENTAL:
        return {};
      case TenantLevel.REC:
        return { OR: [{ tenant_id: user.tenantId }] };
      case TenantLevel.MEMBER_STATE:
        return { tenant_id: user.tenantId };
      default:
        return { tenant_id: user.tenantId };
    }
  }

  private verifyTenantAccess(user: AuthenticatedUser, tenantId: string): void {
    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (tenantId === user.tenantId) return;
    throw new HttpError(404, 'Workflow definition not found');
  }

  // ── Mapping ──

  private toEntity(row: any): WorkflowDefinitionEntity {
    const entity: WorkflowDefinitionEntity = {
      id: row.id,
      tenantId: row.tenant_id,
      countryCode: row.country_code,
      name: row.name,
      description: row.description,
      startLevel: row.start_level,
      endLevel: row.end_level,
      defaultTransmitDelay: row.default_transmit_delay,
      defaultValidationDelay: row.default_validation_delay,
      autoTransmitEnabled: row.auto_transmit_enabled,
      autoValidateEnabled: row.auto_validate_enabled,
      requireComment: row.require_comment,
      allowReject: row.allow_reject,
      allowReturn: row.allow_return,
      isActive: row.is_active,
      isDag: row.is_dag ?? false,
      graphVersion: row.graph_version ?? 1,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.steps) {
      entity.steps = row.steps.map((s: any) => this.toStepEntity(s));
    }

    return entity;
  }

  private toStepEntity(row: any): WorkflowStepEntity {
    return {
      id: row.id,
      definitionId: row.definition_id,
      stepOrder: row.step_order,
      levelType: row.level_type,
      adminLevel: row.admin_level,
      name: row.name,
      canEdit: row.can_edit,
      canValidate: row.can_validate,
      transmitDelayHours: row.transmit_delay_hours,
      stepKey: row.step_key ?? null,
      nodeType: row.node_type ?? 'step',
      mergeStrategy: row.merge_strategy ?? 'ALL',
      allowedRoles: row.allowed_roles ?? null,
      positionX: row.position_x ?? null,
      positionY: row.position_y ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
