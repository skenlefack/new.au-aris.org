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
import { HttpError } from './workflow.service.js';
import type { DefinitionService } from './definition.service.js';

export interface WorkflowTemplateEntity {
  id: string;
  tenantId: string | null;
  category: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  graphSnapshot: any;
  isSystem: boolean;
  tags: string[] | null;
  usageCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  name: Record<string, string>;
  description?: Record<string, string>;
  category?: string;
  tags?: string[];
  graphSnapshot: any;
}

export interface CreateFromDefinitionInput {
  name: Record<string, string>;
  description?: Record<string, string>;
  category?: string;
  tags?: string[];
}

export interface TemplateListQuery extends PaginationQuery {
  category?: string;
  search?: string;
}

export class TemplateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly definitionService: DefinitionService,
  ) {}

  /**
   * List templates: system templates (is_system=true) + tenant templates (tenant_id = user.tenantId).
   * Filter by category, search by name. Paginated.
   */
  async listTemplates(
    user: AuthenticatedUser,
    query: TemplateListQuery,
  ): Promise<PaginatedResponse<WorkflowTemplateEntity>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { is_system: true },
        { tenant_id: user.tenantId },
      ],
    };

    if (query.category) {
      where.category = query.category;
    }

    // Search by name (JSONB contains)
    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { path: ['en'], string_contains: query.search } },
            { name: { path: ['fr'], string_contains: query.search } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).workflowTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ is_system: 'desc' }, { usage_count: 'desc' }, { created_at: 'desc' }],
      }),
      (this.prisma as any).workflowTemplate.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.toEntity(r)),
      meta: { total, page, limit },
    };
  }

  /**
   * Get a single template with full snapshot.
   */
  async getTemplate(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowTemplateEntity>> {
    const row = await (this.prisma as any).workflowTemplate.findUnique({
      where: { id },
    });

    if (!row) {
      throw new HttpError(404, `Workflow template ${id} not found`);
    }

    // System templates are visible to all; tenant templates only to same tenant
    if (!row.is_system && row.tenant_id && row.tenant_id !== user.tenantId) {
      if (user.tenantLevel !== TenantLevel.CONTINENTAL) {
        throw new HttpError(404, `Workflow template ${id} not found`);
      }
    }

    return { data: this.toEntity(row) };
  }

  /**
   * Create a new template directly from a graph snapshot.
   */
  async createTemplate(
    dto: CreateTemplateInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowTemplateEntity>> {
    const row = await (this.prisma as any).workflowTemplate.create({
      data: {
        tenant_id: user.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? 'custom',
        tags: dto.tags ?? null,
        graph_snapshot: dto.graphSnapshot,
        is_system: false,
        created_by: user.userId,
      },
    });

    return { data: this.toEntity(row) };
  }

  /**
   * Create a template from an existing workflow definition's current graph.
   */
  async createFromDefinition(
    definitionId: string,
    dto: CreateFromDefinitionInput,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<WorkflowTemplateEntity>> {
    // Read current graph via getGraph
    const graphResult = await this.definitionService.getGraph(definitionId, user);
    const graphData = graphResult.data;

    // Build the snapshot in the same format as saveGraph expects
    const snapshot = {
      graphVersion: graphData.graphVersion,
      steps: graphData.steps,
      edges: graphData.edges,
    };

    const row = await (this.prisma as any).workflowTemplate.create({
      data: {
        tenant_id: user.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? 'custom',
        tags: dto.tags ?? null,
        graph_snapshot: snapshot,
        is_system: false,
        created_by: user.userId,
      },
    });

    return { data: this.toEntity(row) };
  }

  /**
   * Apply a template to a definition: load the snapshot and call saveGraph.
   * Increments usage_count.
   */
  async applyTemplate(
    templateId: string,
    definitionId: string,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<any>> {
    const template = await (this.prisma as any).workflowTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new HttpError(404, `Workflow template ${templateId} not found`);
    }

    // Get current definition to fetch graph version
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    }

    const snapshot = template.graph_snapshot as any;

    // Build the payload for saveGraph, converting from template format to saveGraph format
    const steps = (snapshot.steps ?? []).map((s: any) => ({
      stepKey: s.stepKey,
      stepOrder: s.stepOrder,
      nodeType: s.nodeType,
      levelType: s.levelType,
      adminLevel: s.adminLevel ?? null,
      name: s.name,
      canEdit: s.canEdit ?? false,
      canValidate: s.canValidate ?? true,
      allowedRoles: s.allowedRoles ?? [],
      mergeStrategy: s.mergeStrategy ?? 'ALL',
      transmitDelayHours: s.transmitDelayHours ?? null,
      positionX: s.positionX ?? null,
      positionY: s.positionY ?? null,
    }));

    const edges = (snapshot.edges ?? []).map((e: any) => ({
      sourceStepKey: e.sourceStepKey ?? e.sourceStepId,
      targetStepKey: e.targetStepKey ?? e.targetStepId,
      edgeType: e.edgeType,
      label: e.label ?? null,
      condition: e.condition ?? null,
      sortOrder: e.sortOrder ?? 0,
    }));

    // Resolve edge sourceStepKey/targetStepKey from step IDs to step keys if needed
    // When the snapshot stores sourceStepId (UUID), we need to map to stepKey
    const stepIdToKey = new Map<string, string>();
    for (const s of snapshot.steps ?? []) {
      if (s.id) stepIdToKey.set(s.id, s.stepKey);
    }

    for (const e of edges) {
      if (stepIdToKey.has(e.sourceStepKey)) e.sourceStepKey = stepIdToKey.get(e.sourceStepKey)!;
      if (stepIdToKey.has(e.targetStepKey)) e.targetStepKey = stepIdToKey.get(e.targetStepKey)!;
    }

    const result = await this.definitionService.saveGraph(
      definitionId,
      {
        graphVersion: definition.graph_version,
        steps,
        edges,
      },
      user,
    );

    // Increment usage_count
    await (this.prisma as any).workflowTemplate.update({
      where: { id: templateId },
      data: { usage_count: { increment: 1 } },
    });

    return result;
  }

  /**
   * Delete a template. Only owner (created_by) or SUPER_ADMIN can delete.
   * Cannot delete system templates.
   */
  async deleteTemplate(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const row = await (this.prisma as any).workflowTemplate.findUnique({
      where: { id },
    });

    if (!row) {
      throw new HttpError(404, `Workflow template ${id} not found`);
    }

    if (row.is_system) {
      throw new HttpError(403, 'Cannot delete system templates');
    }

    if (row.created_by !== user.userId && user.role !== 'SUPER_ADMIN') {
      throw new HttpError(403, 'Only the template owner or SUPER_ADMIN can delete templates');
    }

    await (this.prisma as any).workflowTemplate.delete({ where: { id } });
  }

  // ── Mapping ──

  private toEntity(row: any): WorkflowTemplateEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      category: row.category,
      name: row.name,
      description: row.description,
      graphSnapshot: row.graph_snapshot,
      isSystem: row.is_system,
      tags: row.tags,
      usageCount: row.usage_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
