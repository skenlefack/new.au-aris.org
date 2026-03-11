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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
