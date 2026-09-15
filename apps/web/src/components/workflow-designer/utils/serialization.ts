import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { NodeKind, StepData, EdgeKind, EdgeData } from '../types';
import { asStep, asEdge, mlDisplay } from '../types';
import { EDGE_STYLES } from '../constants';

// ══════════════════════════════════════════════════════════
// SERIALIZATION
// ══════════════════════════════════════════════════════════

export function apiToReactFlow(graphData: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graphData.steps ?? []).map((s: any, i: number) => {
    const nt: NodeKind = s.nodeType ?? 'step';
    return {
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
      } as StepData,
    };
  });

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
  const steps = nodes.map((n, i) => {
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

  const idToKey = new Map(nodes.map((n) => [n.id, asStep(n.data).stepKey]));

  const apiEdges = edges.map((e, i) => ({
    sourceStepKey: idToKey.get(e.source) ?? e.source,
    targetStepKey: idToKey.get(e.target) ?? e.target,
    edgeType: asEdge(e.data)?.edgeType ?? 'SEQUENTIAL',
    label: Object.values(asEdge(e.data)?.label ?? {}).some(Boolean) ? asEdge(e.data).label : undefined,
    condition: asEdge(e.data)?.condition || undefined,
    sortOrder: i,
  }));

  return { graphVersion, steps, edges: apiEdges };
}
