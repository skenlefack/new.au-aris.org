import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { NodeKind, StepData, EdgeKind, EdgeData } from '../types';
import { asStep, asEdge, mlDisplay } from '../types';
import { EDGE_STYLES } from '../constants';

// ══════════════════════════════════════════════════════════
// SERIALIZATION
// ══════════════════════════════════════════════════════════

export function apiToReactFlow(graphData: any): { nodes: Node[]; edges: Edge[] } {
  // Build group membership map: stepKey -> groupKey
  const stepKeyToGroupKey = new Map<string, string>();
  const groups: any[] = graphData.groups ?? [];
  for (const g of groups) {
    for (const sk of g.memberStepKeys ?? []) {
      stepKeyToGroupKey.set(sk, g.groupKey);
    }
  }

  // Create group nodes first (they must come before children in the array)
  const groupNodes: Node[] = groups.map((g: any) => ({
    id: `group-${g.groupKey}`,
    type: 'group' as const,
    position: { x: g.positionX ?? 100, y: g.positionY ?? 100 },
    style: {
      width: g.width ?? 400,
      height: g.height ?? 300,
    },
    data: {
      groupKey: g.groupKey,
      name: g.name ?? { en: g.groupKey },
      description: g.description ?? {},
      color: g.color ?? '#6366f1',
      isCollapsed: g.isCollapsed ?? false,
      memberNodeIds: (g.memberStepKeys ?? []).map((sk: string) => sk),
      nodeType: 'group' as const,
    },
  }));

  const stepNodes: Node[] = (graphData.steps ?? []).map((s: any, i: number) => {
    const nt: NodeKind = s.nodeType ?? 'step';
    const groupKey = stepKeyToGroupKey.get(s.stepKey);
    const node: Node = {
      id: s.id ?? s.stepKey,
      type: nt,
      position: { x: s.positionX ?? 300, y: s.positionY ?? i * 150 },
      data: {
        stepKey: s.stepKey,
        name: s.name ?? { en: s.stepKey },
        description: s.description ?? {},
        nodeType: nt,
        levelType: s.levelType ?? s.stepKey,
        canEdit: s.canEdit ?? false,
        canValidate: s.canValidate ?? true,
        allowedRoles: s.allowedRoles ?? [],
        mergeStrategy: s.mergeStrategy ?? 'ALL',
        transmitDelayHours: s.transmitDelayHours ?? null,
        slaHours: s.slaHours ?? null,
        color: s.color ?? '',
      } as unknown as Record<string, unknown>,
    };
    if (groupKey) {
      node.parentId = `group-${groupKey}`;
      node.extent = 'parent';
    }
    return node;
  });

  const nodes: Node[] = [...groupNodes, ...stepNodes];

  const edges: Edge[] = (graphData.edges ?? []).map((e: any) => {
    const edgeType: EdgeKind = e.edgeType ?? 'SEQUENTIAL';
    const style = EDGE_STYLES[edgeType];
    return {
      id: e.id ?? `${e.sourceStepId}-${e.targetStepId}`,
      source: e.sourceStepId,
      target: e.targetStepId,
      label: mlDisplay(e.label) || (edgeType !== 'SEQUENTIAL' ? edgeType : undefined),
      markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
      style: { stroke: style.color, strokeWidth: 2, strokeDasharray: style.dash },
      data: { edgeType, label: e.label ?? {}, condition: e.condition } as EdgeData,
      animated: style.animated,
    };
  });

  return { nodes, edges };
}

export function reactFlowToApi(nodes: Node[], edges: Edge[], graphVersion: number) {
  // Separate group nodes from step nodes
  const groupNodes = nodes.filter((n) => n.type === 'group');
  const stepNodes = nodes.filter((n) => n.type !== 'group');

  const steps = stepNodes.map((n, i) => {
    const d = asStep(n.data);
    return {
      stepKey: d.stepKey,
      stepOrder: i,
      nodeType: d.nodeType,
      levelType: d.levelType,
      name: d.name,
      description: Object.values(d.description).some(Boolean) ? d.description : undefined,
      canEdit: d.canEdit,
      canValidate: d.canValidate,
      allowedRoles: d.allowedRoles?.length ? d.allowedRoles : undefined,
      mergeStrategy: d.mergeStrategy,
      transmitDelayHours: d.transmitDelayHours,
      slaHours: d.slaHours,
      positionX: n.position.x,
      positionY: n.position.y,
    };
  });

  const idToKey = new Map(stepNodes.map((n) => [n.id, asStep(n.data).stepKey]));

  const apiEdges = edges.map((e, i) => ({
    sourceStepKey: idToKey.get(e.source) ?? e.source,
    targetStepKey: idToKey.get(e.target) ?? e.target,
    edgeType: asEdge(e.data)?.edgeType ?? 'SEQUENTIAL',
    label: Object.values(asEdge(e.data)?.label ?? {}).some(Boolean) ? asEdge(e.data).label : undefined,
    condition: asEdge(e.data)?.condition || undefined,
    sortOrder: i,
  }));

  // Serialize groups: find which step nodes have parentId pointing to a group
  const groups = groupNodes.map((gn) => {
    const gd = gn.data as any;
    const memberStepKeys = stepNodes
      .filter((sn) => sn.parentId === gn.id)
      .map((sn) => asStep(sn.data).stepKey);
    return {
      groupKey: gd.groupKey,
      name: gd.name,
      description: gd.description,
      color: gd.color,
      isCollapsed: gd.isCollapsed ?? false,
      positionX: gn.position.x,
      positionY: gn.position.y,
      width: (gn.style as any)?.width ?? gn.measured?.width ?? 400,
      height: (gn.style as any)?.height ?? gn.measured?.height ?? 300,
      memberStepKeys,
    };
  });

  return { graphVersion, steps, edges: apiEdges, groups };
}
