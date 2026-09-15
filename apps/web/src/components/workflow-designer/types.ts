import type { Node, Edge } from '@xyflow/react';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export type NodeKind = 'start' | 'step' | 'end' | 'decision' | 'fork' | 'join' | 'notification' | 'group';

export interface MultiLang { [key: string]: string }

export interface StepData {
  stepKey: string;
  name: MultiLang;       // { en, fr, pt, ar, es, sw }
  description: MultiLang;
  nodeType: NodeKind;
  levelType: string;
  canEdit: boolean;
  canValidate: boolean;
  allowedRoles: string[];
  mergeStrategy: 'ALL' | 'ANY';
  transmitDelayHours: number | null;
  slaHours: number | null;
  color: string;
}

export type EdgeKind = 'SEQUENTIAL' | 'PARALLEL' | 'CHOICE_SINGLE' | 'CHOICE_MULTI';

export interface EdgeData {
  edgeType: EdgeKind;
  label: MultiLang;
  condition?: string;
}

// Safe casters (ReactFlow types Node.data / Edge.data as Record<string, unknown>)
export function asStep(data: unknown): StepData { return data as StepData; }
export function asEdge(data: unknown): EdgeData { return (data ?? {}) as EdgeData; }

/** Get best display name from a multilingual object */
export function mlDisplay(ml: MultiLang | undefined, fallback = ''): string {
  if (!ml) return fallback;
  return ml.en || ml.fr || ml.pt || Object.values(ml).find(Boolean) || fallback;
}
/** Get secondary display name (FR if EN is primary) */
export function mlSecondary(ml: MultiLang | undefined): string | undefined {
  if (!ml || !ml.fr || ml.fr === ml.en) return undefined;
  return ml.fr;
}

export interface GroupData {
  groupKey: string;
  name: MultiLang;
  description: MultiLang;
  color: string;
  isCollapsed: boolean;
  memberNodeIds: string[];
  nodeType: 'group';
}

export interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

// ══════════════════════════════════════════════════════════
// SIMULATION TYPES
// ══════════════════════════════════════════════════════════

export type SimStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface SimToken {
  id: string;
  nodeId: string;
  progress: number; // 0 = at node, 0-1 = traveling along edge
  edgeId?: string;
  color: string;
}

export interface SimState {
  status: SimStatus;
  tokens: SimToken[];
  visitedNodes: Set<string>;
  activeNodes: Set<string>;
  visitedEdges: Set<string>;
  activeEdges: Set<string>;
  speed: number; // 1 = normal, 2 = fast, 0.5 = slow
  log: { time: number; message: string; type: 'info' | 'move' | 'split' | 'merge' | 'end' }[];
  pendingChoice?: { tokenId: string; nodeId: string; edges: Edge[] };
}
