import type { PrismaClient } from '@prisma/client';
import { TenantLevel } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { HttpError } from './workflow.service.js';
import type { DefinitionService } from './definition.service.js';

export interface VersionListItem {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface VersionDiffResult {
  added: { steps: any[]; edges: any[] };
  removed: { steps: any[]; edges: any[] };
  modified: { steps: any[]; edges: any[] };
  summary: string;
}

export class VersionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly definitionService: DefinitionService,
  ) {}

  /**
   * List all versions for a definition, ordered by version_number DESC.
   */
  async listVersions(definitionId: string, user: AuthenticatedUser) {
    await this.verifyDefinitionAccess(definitionId, user);

    const rows = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id, version_number, change_summary, created_by, created_at
       FROM workflow.workflow_graph_versions
       WHERE definition_id = $1::uuid
       ORDER BY version_number DESC`,
      definitionId,
    );

    const data: VersionListItem[] = (rows as any[]).map((r: any) => ({
      id: r.id,
      versionNumber: r.version_number,
      changeSummary: r.change_summary,
      createdBy: r.created_by,
      createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    }));

    return { data, meta: { total: data.length } };
  }

  /**
   * Get the full snapshot for a specific version.
   */
  async getVersion(definitionId: string, versionNumber: number, user: AuthenticatedUser) {
    await this.verifyDefinitionAccess(definitionId, user);

    const rows = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id, version_number, snapshot, change_summary, created_by, created_at
       FROM workflow.workflow_graph_versions
       WHERE definition_id = $1::uuid AND version_number = $2
       LIMIT 1`,
      definitionId,
      versionNumber,
    );

    const row = (rows as any[])[0];
    if (!row) {
      throw new HttpError(404, `Version ${versionNumber} not found for definition ${definitionId}`);
    }

    return {
      data: {
        id: row.id,
        versionNumber: row.version_number,
        snapshot: row.snapshot,
        changeSummary: row.change_summary,
        createdBy: row.created_by,
        createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
      },
    };
  }

  /**
   * Compare two versions and produce a diff.
   */
  async diffVersions(
    definitionId: string,
    vA: number,
    vB: number,
    user: AuthenticatedUser,
  ): Promise<{ data: VersionDiffResult }> {
    await this.verifyDefinitionAccess(definitionId, user);

    const [resA, resB] = await Promise.all([
      this.getVersion(definitionId, vA, user),
      this.getVersion(definitionId, vB, user),
    ]);

    const snapA = resA.data.snapshot;
    const snapB = resB.data.snapshot;

    // Diff steps by stepKey
    const stepsA = new Map((snapA.steps ?? []).map((s: any) => [s.stepKey, s]));
    const stepsB = new Map((snapB.steps ?? []).map((s: any) => [s.stepKey, s]));

    const addedSteps: any[] = [];
    const removedSteps: any[] = [];
    const modifiedSteps: any[] = [];

    for (const [key, step] of stepsB) {
      if (!stepsA.has(key)) {
        addedSteps.push(step);
      } else {
        const prev = stepsA.get(key);
        if (this.stepsChanged(prev, step)) {
          modifiedSteps.push({ stepKey: key, before: prev, after: step });
        }
      }
    }
    for (const [key, step] of stepsA) {
      if (!stepsB.has(key)) {
        removedSteps.push(step);
      }
    }

    // Diff edges by source+target combo
    const edgeKey = (e: any) => `${e.sourceStepKey ?? e.sourceStepId}→${e.targetStepKey ?? e.targetStepId}`;
    const edgesA = new Map((snapA.edges ?? []).map((e: any) => [edgeKey(e), e]));
    const edgesB = new Map((snapB.edges ?? []).map((e: any) => [edgeKey(e), e]));

    const addedEdges: any[] = [];
    const removedEdges: any[] = [];
    const modifiedEdges: any[] = [];

    for (const [key, edge] of edgesB) {
      if (!edgesA.has(key)) {
        addedEdges.push(edge);
      } else {
        const prev = edgesA.get(key);
        if (JSON.stringify(prev) !== JSON.stringify(edge)) {
          modifiedEdges.push({ key, before: prev, after: edge });
        }
      }
    }
    for (const [key, edge] of edgesA) {
      if (!edgesB.has(key)) {
        removedEdges.push(edge);
      }
    }

    const parts: string[] = [];
    if (addedSteps.length) parts.push(`${addedSteps.length} node(s) added`);
    if (removedSteps.length) parts.push(`${removedSteps.length} node(s) removed`);
    if (modifiedSteps.length) parts.push(`${modifiedSteps.length} node(s) modified`);
    if (addedEdges.length) parts.push(`${addedEdges.length} edge(s) added`);
    if (removedEdges.length) parts.push(`${removedEdges.length} edge(s) removed`);
    if (modifiedEdges.length) parts.push(`${modifiedEdges.length} edge(s) modified`);

    return {
      data: {
        added: { steps: addedSteps, edges: addedEdges },
        removed: { steps: removedSteps, edges: removedEdges },
        modified: { steps: modifiedSteps, edges: modifiedEdges },
        summary: parts.length ? parts.join(', ') : 'No changes',
      },
    };
  }

  /**
   * Restore a previous version by calling saveGraph with its snapshot.
   */
  async restoreVersion(
    definitionId: string,
    versionNumber: number,
    user: AuthenticatedUser,
  ) {
    const versionRes = await this.getVersion(definitionId, versionNumber, user);
    const snapshot = versionRes.data.snapshot;

    // Get current definition to know the graph_version
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
    });
    if (!definition) throw new HttpError(404, `Definition ${definitionId} not found`);

    // Build the body expected by saveGraph
    const body = {
      graphVersion: definition.graph_version,
      steps: (snapshot.steps ?? []).map((s: any) => ({
        stepKey: s.stepKey,
        stepOrder: s.stepOrder ?? 0,
        nodeType: s.nodeType ?? 'step',
        levelType: s.levelType,
        adminLevel: s.adminLevel,
        name: s.name ?? {},
        canEdit: s.canEdit ?? false,
        canValidate: s.canValidate ?? true,
        allowedRoles: s.allowedRoles,
        mergeStrategy: s.mergeStrategy,
        transmitDelayHours: s.transmitDelayHours,
        positionX: s.positionX,
        positionY: s.positionY,
      })),
      edges: (snapshot.edges ?? []).map((e: any) => ({
        sourceStepKey: e.sourceStepKey ?? e.sourceStepId,
        targetStepKey: e.targetStepKey ?? e.targetStepId,
        edgeType: e.edgeType ?? 'SEQUENTIAL',
        label: e.label,
        condition: e.condition,
        sortOrder: e.sortOrder ?? 0,
      })),
    };

    return this.definitionService.saveGraph(definitionId, body, user);
  }

  // ── helpers ──

  private stepsChanged(a: any, b: any): boolean {
    // Compare relevant fields
    const fields = ['name', 'nodeType', 'levelType', 'canEdit', 'canValidate',
      'mergeStrategy', 'allowedRoles', 'transmitDelayHours', 'positionX', 'positionY'];
    for (const f of fields) {
      if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) return true;
    }
    return false;
  }

  private async verifyDefinitionAccess(definitionId: string, user: AuthenticatedUser): Promise<void> {
    const definition = await (this.prisma as any).workflowDefinition.findUnique({
      where: { id: definitionId },
      select: { tenant_id: true },
    });

    if (!definition) {
      throw new HttpError(404, `Workflow definition ${definitionId} not found`);
    }

    if (user.tenantLevel === TenantLevel.CONTINENTAL) return;
    if (definition.tenant_id === user.tenantId) return;
    throw new HttpError(404, 'Workflow definition not found');
  }
}
