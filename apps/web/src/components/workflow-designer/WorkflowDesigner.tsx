'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Position,
  Handle,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  Square,
  CheckCircle2,
  GitBranch,
  Save,
  AlertTriangle,
  Trash2,
  X,
  Loader2,
  Undo2,
  Redo2,
  ZoomIn,
  LayoutGrid,
  Download,
  ShieldCheck,
  Clock,
  Users,
  GitFork,
  Diamond,
  Bell,
  Timer,
  Pencil,
  Eye,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Copy,
  Maximize2,
  CircleDot,
  ArrowRightLeft,
  Merge,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowGraph, useSaveWorkflowGraph } from '@/lib/api/workflow-hooks';
import { toast } from 'sonner';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type NodeKind = 'start' | 'step' | 'end' | 'decision' | 'fork' | 'join' | 'notification';

interface StepData {
  stepKey: string;
  label: string;
  labelFr: string;
  description: string;
  descriptionFr: string;
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

type EdgeKind = 'SEQUENTIAL' | 'PARALLEL' | 'CHOICE_SINGLE' | 'CHOICE_MULTI';

interface EdgeData {
  edgeType: EdgeKind;
  label?: string;
  labelFr?: string;
  condition?: string;
}

// Safe casters (ReactFlow types Node.data / Edge.data as Record<string, unknown>)
function asStep(data: unknown): StepData { return data as StepData; }
function asEdge(data: unknown): EdgeData { return (data ?? {}) as EdgeData; }

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════

const ROLES = [
  'SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN',
  'DATA_STEWARD', 'WAHIS_FOCAL_POINT', 'ANALYST', 'FIELD_AGENT',
  'KNOWLEDGE_MANAGER', 'NATIONAL_LABORATORY', 'REGIONAL_LABORATORY',
  'CONTINENTAL_LABORATORY', 'PAID_ADMIN',
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  CONTINENTAL_ADMIN: 'Continental Admin',
  REC_ADMIN: 'REC Admin',
  NATIONAL_ADMIN: 'National Admin',
  DATA_STEWARD: 'Data Steward',
  WAHIS_FOCAL_POINT: 'WAHIS Focal Point',
  ANALYST: 'Analyst',
  FIELD_AGENT: 'Field Agent',
  KNOWLEDGE_MANAGER: 'Knowledge Manager',
  NATIONAL_LABORATORY: 'National Lab',
  REGIONAL_LABORATORY: 'Regional Lab',
  CONTINENTAL_LABORATORY: 'Continental Lab',
  PAID_ADMIN: 'PAID Admin',
};

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; darkBg: string }> = {
  NATIONAL_TECHNICAL:      { label: 'National Technical',      color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-400',   darkBg: 'dark:bg-blue-900/20' },
  NATIONAL_OFFICIAL:       { label: 'National Official',       color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-400',  darkBg: 'dark:bg-amber-900/20' },
  REC_HARMONIZATION:       { label: 'REC Harmonization',       color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-400', darkBg: 'dark:bg-purple-900/20' },
  CONTINENTAL_PUBLICATION: { label: 'Continental Publication', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-400',    darkBg: 'dark:bg-red-900/20' },
  national:                { label: 'National',                color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-400',   darkBg: 'dark:bg-blue-900/20' },
  regional:                { label: 'Regional',                color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-400', darkBg: 'dark:bg-purple-900/20' },
  continental:             { label: 'Continental',             color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-400',    darkBg: 'dark:bg-red-900/20' },
};

const EDGE_STYLES: Record<EdgeKind, { color: string; dash: string; animated: boolean; label: string }> = {
  SEQUENTIAL:   { color: '#6b7280', dash: '0',   animated: false, label: 'Sequential' },
  PARALLEL:     { color: '#8b5cf6', dash: '0',   animated: true,  label: 'Parallel (fan-out)' },
  CHOICE_SINGLE:{ color: '#f59e0b', dash: '8 4', animated: false, label: 'Choice — Single' },
  CHOICE_MULTI: { color: '#10b981', dash: '8 4', animated: false, label: 'Choice — Multiple' },
};

const NODE_CATALOG: { type: NodeKind; label: string; labelFr: string; icon: React.ReactNode; description: string; color: string }[] = [
  { type: 'start',        label: 'Start',        labelFr: 'Début',        icon: <Play className="h-4 w-4" />,         description: 'Entry point',       color: 'text-green-600' },
  { type: 'step',         label: 'Step',         labelFr: 'Étape',        icon: <CheckCircle2 className="h-4 w-4" />, description: 'Validation step',   color: 'text-blue-600' },
  { type: 'decision',     label: 'Decision',     labelFr: 'Décision',     icon: <Diamond className="h-4 w-4" />,      description: 'Conditional routing',color: 'text-amber-600' },
  { type: 'fork',         label: 'Fork',         labelFr: 'Fourche',      icon: <GitFork className="h-4 w-4" />,      description: 'Parallel split',    color: 'text-purple-600' },
  { type: 'join',         label: 'Join',         labelFr: 'Jonction',     icon: <Merge className="h-4 w-4" />,        description: 'Merge branches',    color: 'text-indigo-600' },
  { type: 'notification', label: 'Notification', labelFr: 'Notification', icon: <Bell className="h-4 w-4" />,         description: 'Send alert',        color: 'text-pink-600' },
  { type: 'end',          label: 'End',          labelFr: 'Fin',          icon: <Square className="h-4 w-4" />,        description: 'Terminal state',    color: 'text-red-600' },
];

// ══════════════════════════════════════════════════════════
// CUSTOM NODES
// ══════════════════════════════════════════════════════════

function StartNode({ data, selected }: NodeProps) {
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-200',
      'h-[72px] w-[72px]',
      selected ? 'border-green-500 ring-2 ring-green-300 ring-offset-2 scale-110' : 'border-green-400 hover:border-green-500 hover:shadow-xl',
      'bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40',
    )}>
      <Play className="h-6 w-6 text-green-600 drop-shadow-sm" />
      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">Start</span>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
    </div>
  );
}

function StepNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  const level = LEVEL_CONFIG[d.levelType];
  const borderColor = level?.border ?? 'border-gray-300';
  const bgColor = level?.bg ?? 'bg-white';
  const darkBgColor = level?.darkBg ?? 'dark:bg-gray-800';
  const hasRoles = d.allowedRoles?.length > 0;
  const hasSLA = d.slaHours || d.transmitDelayHours;

  return (
    <div className={cn(
      'group relative rounded-xl border-2 shadow-lg transition-all duration-200 min-w-[200px] max-w-[260px]',
      borderColor, bgColor, darkBgColor,
      selected ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.03] shadow-xl' : 'hover:shadow-xl hover:scale-[1.01]',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight">{d.label || 'Untitled'}</div>
            {d.labelFr && d.labelFr !== d.label && (
              <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{d.labelFr}</div>
            )}
          </div>
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider', level?.bg, level?.color)}>
            {level?.label?.split(' ')[0] ?? d.levelType}
          </span>
        </div>
        {d.description && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 line-clamp-2 leading-snug">{d.description}</p>
        )}
      </div>

      {/* Footer badges */}
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
        {d.canEdit && (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[8px] font-medium text-blue-700 dark:text-blue-300">
            <Pencil className="h-2.5 w-2.5" /> Edit
          </span>
        )}
        {d.canValidate && (
          <span className="inline-flex items-center gap-0.5 rounded bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[8px] font-medium text-green-700 dark:text-green-300">
            <ShieldCheck className="h-2.5 w-2.5" /> Validate
          </span>
        )}
        {d.mergeStrategy === 'ANY' && (
          <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-[8px] font-medium text-orange-700 dark:text-orange-300">
            <ArrowRightLeft className="h-2.5 w-2.5" /> ANY
          </span>
        )}
        {hasRoles && (
          <span className="inline-flex items-center gap-0.5 rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-[8px] font-medium text-violet-700 dark:text-violet-300">
            <Users className="h-2.5 w-2.5" /> {d.allowedRoles.length}
          </span>
        )}
        {hasSLA && (
          <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[8px] font-medium text-gray-600 dark:text-gray-300">
            <Clock className="h-2.5 w-2.5" /> {d.slaHours ?? d.transmitDelayHours}h
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
    </div>
  );
}

function DecisionNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex items-center justify-center transition-all duration-200',
      selected ? 'scale-110' : 'hover:scale-105',
    )}>
      <div className={cn(
        'h-[72px] w-[72px] rotate-45 rounded-lg border-2 shadow-lg',
        selected ? 'border-amber-500 ring-2 ring-amber-300 ring-offset-2' : 'border-amber-400 hover:border-amber-500',
        'bg-gradient-to-br from-amber-50 via-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40',
      )} />
      <div className="absolute flex flex-col items-center">
        <Diamond className="h-5 w-5 text-amber-600" />
        <span className="mt-0.5 text-[8px] font-bold text-amber-700 dark:text-amber-300 max-w-[60px] truncate text-center">{d.label || '?'}</span>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
    </div>
  );
}

function ForkNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-lg border-2 shadow-lg transition-all duration-200',
      'h-[44px] w-[120px]',
      selected ? 'border-purple-500 ring-2 ring-purple-300 ring-offset-2 scale-110' : 'border-purple-400 hover:border-purple-500',
      'bg-gradient-to-r from-purple-50 via-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40',
    )}>
      <GitFork className="h-4 w-4 text-purple-600" />
      <span className="text-[8px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">{d.label || 'Fork'}</span>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
      <Handle type="source" position={Position.Left} id="left-src" className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
    </div>
  );
}

function JoinNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-lg border-2 shadow-lg transition-all duration-200',
      'h-[44px] w-[120px]',
      selected ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-2 scale-110' : 'border-indigo-400 hover:border-indigo-500',
      'bg-gradient-to-r from-indigo-50 via-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40',
    )}>
      <Merge className="h-4 w-4 text-indigo-600" />
      <span className="text-[8px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{d.label || 'Join'}</span>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
      <Handle type="target" position={Position.Right} id="right-tgt" className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
    </div>
  );
}

function NotificationNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed shadow-lg transition-all duration-200',
      'h-[60px] w-[140px]',
      selected ? 'border-pink-500 ring-2 ring-pink-300 ring-offset-2 scale-110' : 'border-pink-400 hover:border-pink-500',
      'bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 dark:from-pink-900/30 dark:to-rose-900/30',
    )}>
      <Bell className="h-4 w-4 text-pink-600" />
      <span className="text-[8px] font-bold text-pink-700 dark:text-pink-300 max-w-[120px] truncate">{d.label || 'Notify'}</span>
      <Handle type="target" position={Position.Top} className="!bg-pink-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-pink-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
    </div>
  );
}

function EndNode({ data, selected }: NodeProps) {
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-200',
      'h-[72px] w-[72px]',
      selected ? 'border-red-500 ring-2 ring-red-300 ring-offset-2 scale-110' : 'border-red-400 hover:border-red-500 hover:shadow-xl',
      'bg-gradient-to-br from-red-50 via-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40',
    )}>
      <div className="h-6 w-6 rounded-full border-[3px] border-red-500 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-red-500" />
      </div>
      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">End</span>
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-red-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode as any,
  step: StepNode as any,
  decision: DecisionNode as any,
  fork: ForkNode as any,
  join: JoinNode as any,
  notification: NotificationNode as any,
  end: EndNode as any,
};

// ══════════════════════════════════════════════════════════
// SERIALIZATION
// ══════════════════════════════════════════════════════════

function apiToReactFlow(graphData: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graphData.steps ?? []).map((s: any, i: number) => {
    const nt: NodeKind = s.nodeType ?? 'step';
    return {
      id: s.id ?? s.stepKey,
      type: nt,
      position: { x: s.positionX ?? 300, y: s.positionY ?? i * 150 },
      data: {
        stepKey: s.stepKey,
        label: s.name?.en ?? s.stepKey,
        labelFr: s.name?.fr ?? '',
        description: s.description?.en ?? '',
        descriptionFr: s.description?.fr ?? '',
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
      label: e.label?.en ?? (edgeType !== 'SEQUENTIAL' ? style.label : undefined),
      markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
      style: { stroke: style.color, strokeWidth: 2, strokeDasharray: style.dash },
      data: { edgeType, label: e.label?.en, labelFr: e.label?.fr, condition: e.condition } as EdgeData,
      animated: style.animated,
    };
  });

  return { nodes, edges };
}

function reactFlowToApi(nodes: Node[], edges: Edge[], graphVersion: number) {
  const steps = nodes.map((n, i) => {
    const d = asStep(n.data);
    return {
      stepKey: d.stepKey,
      stepOrder: i,
      nodeType: d.nodeType,
      levelType: d.levelType,
      name: { en: d.label, fr: d.labelFr || d.label },
      description: d.description ? { en: d.description, fr: d.descriptionFr || d.description } : undefined,
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
    label: asEdge(e.data)?.label ? { en: asEdge(e.data).label, fr: asEdge(e.data).labelFr } : undefined,
    condition: asEdge(e.data)?.condition || undefined,
    sortOrder: i,
  }));

  return { graphVersion, steps, edges: apiEdges };
}

// ══════════════════════════════════════════════════════════
// TOOLBOX PANEL (Drag & Drop)
// ══════════════════════════════════════════════════════════

function ToolboxPanel({ hasStart }: { hasStart: boolean }) {
  const [collapsed, setCollapsed] = useState(false);

  const onDragStart = useCallback((e: DragEvent, nodeType: NodeKind) => {
    e.dataTransfer.setData('application/reactflow-type', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 w-[180px]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
      >
        <span>Toolbox</span>
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-0.5">
          {NODE_CATALOG.map((item) => {
            const disabled = item.type === 'start' && hasStart;
            return (
              <div
                key={item.type}
                draggable={!disabled}
                onDragStart={(e) => onDragStart(e, item.type)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all cursor-grab active:cursor-grabbing',
                  disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-sm',
                  item.color,
                )}
                title={disabled ? 'Only one Start node allowed' : `Drag to add ${item.label}`}
              >
                <GripVertical className="h-3 w-3 text-gray-300 shrink-0" />
                {item.icon}
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{item.label}</div>
                  <div className="text-[9px] text-gray-400 leading-tight">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PROPERTIES PANEL
// ══════════════════════════════════════════════════════════

function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDuplicate,
  onClose,
}: {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (id: string, data: Partial<StepData>) => void;
  onUpdateEdge: (id: string, data: Partial<EdgeData>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true, permissions: true, timing: false, roles: false,
  });

  const toggleSection = (key: string) => setExpandedSections((s) => ({ ...s, [key]: !s[key] }));

  if (!selectedNode && !selectedEdge) return null;

  // ── Edge Properties ──
  if (selectedEdge) {
    const d = asEdge(selectedEdge.data);
    return (
      <div className="w-80 rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Connection</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Type</label>
            <select
              value={d.edgeType ?? 'SEQUENTIAL'}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { edgeType: e.target.value as EdgeKind })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(EDGE_STYLES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-0.5 w-8 rounded" style={{ backgroundColor: EDGE_STYLES[d.edgeType ?? 'SEQUENTIAL'].color }} />
              <span className="text-[9px] text-gray-400">
                {d.edgeType === 'PARALLEL' && 'All targets activate simultaneously'}
                {d.edgeType === 'CHOICE_SINGLE' && 'User picks exactly one target'}
                {d.edgeType === 'CHOICE_MULTI' && 'User picks one or more targets'}
                {(d.edgeType === 'SEQUENTIAL' || !d.edgeType) && 'One step after another'}
              </span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Label (EN)</label>
            <input
              value={d.label ?? ''}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Approved → Send to REC"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Label (FR)</label>
            <input
              value={d.labelFr ?? ''}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { labelFr: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="ex. Approuvé → Envoyer au REC"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Condition (optional)</label>
            <textarea
              value={d.condition ?? ''}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { condition: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder='e.g. status === "confirmed"'
            />
            <p className="mt-1 text-[9px] text-gray-400">JavaScript expression evaluated at runtime</p>
          </div>
          <button
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Connection
          </button>
        </div>
      </div>
    );
  }

  // ── Node Properties ──
  if (selectedNode) {
    const d = asStep(selectedNode.data);
    const isStart = d.nodeType === 'start';
    const isEnd = d.nodeType === 'end';
    const isStep = d.nodeType === 'step';
    const isDecision = d.nodeType === 'decision';
    const isForkJoin = d.nodeType === 'fork' || d.nodeType === 'join';
    const isNotification = d.nodeType === 'notification';
    const showFullProps = isStep || isDecision;

    const nodeLabel = NODE_CATALOG.find((n) => n.type === d.nodeType)?.label ?? d.nodeType;
    const nodeIcon = NODE_CATALOG.find((n) => n.type === d.nodeType)?.icon;

    // Section header component
    const SectionHeader = ({ id, title, icon }: { id: string; title: string; icon: React.ReactNode }) => (
      <button
        onClick={() => toggleSection(id)}
        className="flex items-center justify-between w-full py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
      >
        <span className="flex items-center gap-1.5">{icon} {title}</span>
        {expandedSections[id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
    );

    return (
      <div className="w-80 rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            {nodeIcon}
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{nodeLabel}</h3>
          </div>
          <div className="flex items-center gap-1">
            {!isStart && (
              <button
                onClick={() => onDuplicate(selectedNode.id)}
                className="rounded-md p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title="Duplicate"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1">
          {/* ── General Section ── */}
          <SectionHeader id="general" title="General" icon={<Info className="h-3 w-3" />} />
          {expandedSections.general && (
            <div className="space-y-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Key</label>
                <input
                  value={d.stepKey}
                  onChange={(e) => onUpdateNode(selectedNode.id, { stepKey: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  readOnly={isStart}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name (EN)</label>
                  <input
                    value={d.label}
                    onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name (FR)</label>
                  <input
                    value={d.labelFr}
                    onChange={(e) => onUpdateNode(selectedNode.id, { labelFr: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {(showFullProps || isNotification || isForkJoin) && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description (EN)</label>
                  <textarea
                    value={d.description ?? ''}
                    onChange={(e) => onUpdateNode(selectedNode.id, { description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="What happens at this step..."
                  />
                </div>
              )}
              {showFullProps && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Level Type</label>
                  <select
                    value={d.levelType}
                    onChange={(e) => onUpdateNode(selectedNode.id, { levelType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(LEVEL_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Permissions Section ── */}
          {showFullProps && (
            <>
              <SectionHeader id="permissions" title="Permissions" icon={<ShieldCheck className="h-3 w-3" />} />
              {expandedSections.permissions && (
                <div className="space-y-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.canEdit}
                        onChange={(e) => onUpdateNode(selectedNode.id, { canEdit: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Pencil className="h-3 w-3 text-blue-500" /> Can Edit
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.canValidate}
                        onChange={(e) => onUpdateNode(selectedNode.id, { canValidate: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <ShieldCheck className="h-3 w-3 text-green-500" /> Can Validate
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Merge Strategy</label>
                    <div className="mt-1.5 flex gap-2">
                      {(['ALL', 'ANY'] as const).map((val) => (
                        <button
                          key={val}
                          onClick={() => onUpdateNode(selectedNode.id, { mergeStrategy: val })}
                          className={cn(
                            'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                            d.mergeStrategy === val
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600',
                          )}
                        >
                          <div className="font-bold">{val}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5">
                            {val === 'ALL' ? 'Wait all branches' : 'First branch unlocks'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Timing Section ── */}
          {(showFullProps || isNotification) && (
            <>
              <SectionHeader id="timing" title="Timing & SLA" icon={<Timer className="h-3 w-3" />} />
              {expandedSections.timing && (
                <div className="space-y-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">SLA (hours)</label>
                      <input
                        type="number"
                        min={0}
                        value={d.slaHours ?? ''}
                        onChange={(e) => onUpdateNode(selectedNode.id, { slaHours: e.target.value ? Number(e.target.value) : null })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                        placeholder="48"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Auto-transmit (h)</label>
                      <input
                        type="number"
                        min={0}
                        value={d.transmitDelayHours ?? ''}
                        onChange={(e) => onUpdateNode(selectedNode.id, { transmitDelayHours: e.target.value ? Number(e.target.value) : null })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                        placeholder="72"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 flex items-center gap-1">
                    <Info className="h-3 w-3" /> SLA = max time before escalation. Auto-transmit = auto-forward after delay.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Roles Section ── */}
          {showFullProps && (
            <>
              <SectionHeader id="roles" title={`Allowed Roles (${d.allowedRoles?.length || 0})`} icon={<Users className="h-3 w-3" />} />
              {expandedSections.roles && (
                <div className="space-y-1 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[9px] text-gray-400 mb-2">Leave empty = all roles can access this step</p>
                  <div className="grid grid-cols-1 gap-0.5 max-h-[200px] overflow-y-auto">
                    {ROLES.map((role) => {
                      const checked = d.allowedRoles?.includes(role);
                      return (
                        <label
                          key={role}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] cursor-pointer transition',
                            checked ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const roles = d.allowedRoles ?? [];
                              const next = e.target.checked
                                ? [...roles, role]
                                : roles.filter((r) => r !== role);
                              onUpdateNode(selectedNode.id, { allowedRoles: next });
                            }}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 h-3 w-3"
                          />
                          {ROLE_LABELS[role] ?? role}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Join merge strategy */}
          {d.nodeType === 'join' && (
            <div className="pb-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Merge Strategy</label>
              <div className="mt-1.5 flex gap-2">
                {(['ALL', 'ANY'] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => onUpdateNode(selectedNode.id, { mergeStrategy: val })}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                      d.mergeStrategy === val
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600',
                    )}
                  >
                    {val === 'ALL' ? 'Wait All' : 'First Wins'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Delete */}
        {!isStart && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              onClick={() => onDeleteNode(selectedNode.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete {nodeLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// VALIDATION PANEL
// ══════════════════════════════════════════════════════════

function ValidationPanel({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/95 shadow-lg backdrop-blur dark:border-amber-800 dark:bg-amber-900/30 p-3 max-w-[280px]">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Validation Issues ({errors.length})</span>
      </div>
      <ul className="space-y-1">
        {errors.slice(0, 5).map((err, i) => (
          <li key={i} className="text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
            <span className="mt-0.5">•</span> {err}
          </li>
        ))}
        {errors.length > 5 && (
          <li className="text-[10px] text-amber-600 font-medium">... and {errors.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// CLIENT-SIDE GRAPH VALIDATION
// ══════════════════════════════════════════════════════════

function validateGraph(nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = [];
  const starts = nodes.filter((n) => asStep(n.data).nodeType === 'start');
  const ends = nodes.filter((n) => asStep(n.data).nodeType === 'end');

  if (starts.length === 0) errors.push('Missing START node');
  if (starts.length > 1) errors.push('Multiple START nodes — only one allowed');
  if (ends.length === 0) errors.push('Missing END node — add at least one');

  // Check for nodes without connections (except if only 1 node)
  if (nodes.length > 1) {
    for (const node of nodes) {
      const d = asStep(node.data);
      const hasIncoming = edges.some((e) => e.target === node.id);
      const hasOutgoing = edges.some((e) => e.source === node.id);

      if (d.nodeType === 'start' && !hasOutgoing) errors.push(`START has no outgoing connection`);
      if (d.nodeType === 'end' && !hasIncoming) errors.push(`END "${d.label}" has no incoming connection`);
      if (d.nodeType !== 'start' && d.nodeType !== 'end' && !hasIncoming && !hasOutgoing) {
        errors.push(`"${d.label}" is disconnected`);
      }
      if (d.nodeType !== 'end' && d.nodeType !== 'start' && !hasOutgoing) {
        errors.push(`"${d.label}" has no outgoing connection (dead end)`);
      }
    }
  }

  // Check for self-loops
  for (const edge of edges) {
    if (edge.source === edge.target) errors.push('Self-loop detected');
  }

  // Mixed edge types from same source
  const edgesBySource = new Map<string, Set<string>>();
  for (const edge of edges) {
    const types = edgesBySource.get(edge.source) ?? new Set();
    types.add(asEdge(edge.data)?.edgeType ?? 'SEQUENTIAL');
    edgesBySource.set(edge.source, types);
  }
  for (const [sourceId, types] of edgesBySource) {
    if (types.size > 1) {
      const node = nodes.find((n) => n.id === sourceId);
      const label = asStep(node?.data)?.label ?? sourceId;
      errors.push(`"${label}" has mixed edge types — all outgoing must be same type`);
    }
  }

  return errors;
}

// ══════════════════════════════════════════════════════════
// AUTO LAYOUT (Dagre-like simple algorithm)
// ══════════════════════════════════════════════════════════

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Build adjacency
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target]);
    incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source]);
  }

  // Topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const n of nodes) inDegree.set(n.id, 0);
  for (const e of edges) inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const levels = new Map<string, number>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    const level = levels.get(id) ?? 0;
    for (const target of outgoing.get(id) ?? []) {
      levels.set(target, Math.max(levels.get(target) ?? 0, level + 1));
      inDegree.set(target, (inDegree.get(target) ?? 0) - 1);
      if (inDegree.get(target) === 0) queue.push(target);
    }
  }

  // Assign positions: unvisited nodes get incremental level
  let maxLevel = 0;
  for (const n of nodes) {
    if (!levels.has(n.id)) levels.set(n.id, ++maxLevel);
    else maxLevel = Math.max(maxLevel, levels.get(n.id)!);
  }

  // Group by level
  const byLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    byLevel.set(level, [...(byLevel.get(level) ?? []), id]);
  }

  const V_GAP = 160;
  const H_GAP = 280;

  return nodes.map((n) => {
    const level = levels.get(n.id) ?? 0;
    const siblings = byLevel.get(level) ?? [n.id];
    const idx = siblings.indexOf(n.id);
    const totalWidth = (siblings.length - 1) * H_GAP;
    const x = 400 + idx * H_GAP - totalWidth / 2;
    const y = 80 + level * V_GAP;
    return { ...n, position: { x, y } };
  });
}

// ══════════════════════════════════════════════════════════
// MAIN DESIGNER (inner component, needs ReactFlowProvider)
// ══════════════════════════════════════════════════════════

interface WorkflowDesignerInnerProps {
  definitionId: string;
  onClose: () => void;
}

function WorkflowDesignerInner({ definitionId, onClose }: WorkflowDesignerInnerProps) {
  const { data: graphRes, isLoading } = useWorkflowGraph(definitionId);
  const saveMut = useSaveWorkflowGraph();
  const reactFlowInstance = useReactFlow();

  const graphData = graphRes?.data;
  const graphVersion = graphData?.graphVersion ?? 1;

  const initial = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };
    return apiToReactFlow(graphData);
  }, [graphData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const nodeCounter = useRef(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Undo/Redo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const isUndoRedo = useRef(false);

  const pushHistory = useCallback((ns: Node[], es: Edge[]) => {
    if (isUndoRedo.current) { isUndoRedo.current = false; return; }
    setHistory((h) => {
      const truncated = h.slice(0, historyIdx + 1);
      const next = [...truncated, { nodes: ns, edges: es }];
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIdx((i) => Math.min(i + 1, 49));
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    isUndoRedo.current = true;
    const prev = history[historyIdx - 1];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistoryIdx(historyIdx - 1);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [history, historyIdx, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    isUndoRedo.current = true;
    const next = history[historyIdx + 1];
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistoryIdx(historyIdx + 1);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [history, historyIdx, setNodes, setEdges]);

  // Sync when data loads
  useEffect(() => {
    if (initial.nodes.length > 0) {
      setNodes(initial.nodes);
      setEdges(initial.edges);
      // Find max counter
      let max = 0;
      for (const n of initial.nodes) {
        const match = n.id.match(/\d+/);
        if (match) max = Math.max(max, parseInt(match[0], 10));
      }
      nodeCounter.current = max + 1;
      // Init history
      setHistory([{ nodes: initial.nodes, edges: initial.edges }]);
      setHistoryIdx(0);
    }
  }, [initial, setNodes, setEdges]);

  // Push history on meaningful changes (debounced)
  const historyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => pushHistory(nodes, edges), 500);
    return () => clearTimeout(historyTimer.current);
  }, [nodes, edges, pushHistory]);

  // Live validation
  useEffect(() => {
    setValidationErrors(validateGraph(nodes, edges));
  }, [nodes, edges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode && asStep(selectedNode.data).nodeType !== 'start') {
          handleDeleteNode(selectedNode.id);
        } else if (selectedEdge) {
          handleDeleteEdge(selectedEdge.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedNode, selectedEdge]);

  const onConnect = useCallback((connection: Connection) => {
    const style = EDGE_STYLES.SEQUENTIAL;
    setEdges((eds) => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
      style: { stroke: style.color, strokeWidth: 2 },
      data: { edgeType: 'SEQUENTIAL' } as EdgeData,
    }, eds));
  }, [setEdges]);

  // Drop handler for drag-and-drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow-type') as NodeKind;
    if (!type) return;

    // Prevent multiple starts
    if (type === 'start' && nodes.some((n) => asStep(n.data).nodeType === 'start')) {
      toast.error('Only one Start node is allowed');
      return;
    }

    const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const idx = ++nodeCounter.current;
    const catalog = NODE_CATALOG.find((n) => n.type === type)!;

    const newNode: Node = {
      id: `new-${idx}`,
      type,
      position,
      data: {
        stepKey: type === 'start' ? 'START' : type === 'end' ? `END_${idx}` : `${type.toUpperCase()}_${idx}`,
        label: catalog.label,
        labelFr: catalog.labelFr,
        description: '',
        descriptionFr: '',
        nodeType: type,
        levelType: type === 'step' || type === 'decision' ? 'NATIONAL_TECHNICAL' : type,
        canEdit: false,
        canValidate: type === 'step',
        allowedRoles: [],
        mergeStrategy: type === 'join' ? 'ALL' as const : 'ALL' as const,
        transmitDelayHours: null,
        slaHours: null,
        color: '',
      } as StepData,
    };
    setNodes((nds) => [...nds, newNode]);
    // Auto-select the new node
    setSelectedNode(newNode);
    setSelectedEdge(null);
  }, [nodes, setNodes, reactFlowInstance]);

  const handleUpdateNode = useCallback((id: string, partial: Partial<StepData>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...partial } } : n));
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...partial } } : prev);
  }, [setNodes]);

  const handleUpdateEdge = useCallback((id: string, partial: Partial<EdgeData>) => {
    setEdges((eds) => eds.map((e) => {
      if (e.id !== id) return e;
      const newData = { ...asEdge(e.data), ...partial };
      const edgeType = newData.edgeType ?? 'SEQUENTIAL';
      const style = EDGE_STYLES[edgeType];
      return {
        ...e,
        data: newData,
        label: newData.label || (edgeType !== 'SEQUENTIAL' ? style.label : undefined),
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        style: { stroke: style.color, strokeWidth: 2, strokeDasharray: style.dash },
        animated: style.animated,
      };
    }));
    setSelectedEdge((prev) => prev?.id === id ? { ...prev, data: { ...asEdge(prev.data), ...partial } } : prev);
  }, [setEdges]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelectedEdge(null);
  }, [setEdges]);

  const handleDuplicate = useCallback((id: string) => {
    const original = nodes.find((n) => n.id === id);
    if (!original) return;
    const d = asStep(original.data);
    if (d.nodeType === 'start') return;
    const idx = ++nodeCounter.current;
    const newNode: Node = {
      id: `new-${idx}`,
      type: original.type,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: {
        ...d,
        stepKey: `${d.stepKey}_COPY_${idx}`,
        label: `${d.label} (copy)`,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  }, [nodes, setNodes]);

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 }), 50);
    toast.success('Layout applied');
  }, [nodes, edges, setNodes, reactFlowInstance]);

  const handleSave = useCallback(async () => {
    const errs = validateGraph(nodes, edges);
    if (errs.length > 0) {
      toast.error(`Cannot save: ${errs.length} validation issue(s)`, { description: errs[0] });
      return;
    }
    const payload = reactFlowToApi(nodes, edges, graphVersion);
    try {
      await saveMut.mutateAsync({ definitionId, ...payload });
      toast.success('Workflow graph saved successfully');
    } catch (err: any) {
      toast.error('Failed to save', { description: err?.message ?? 'Check graph for errors' });
    }
  }, [nodes, edges, graphVersion, definitionId, saveMut]);

  const handleExportJSON = useCallback(() => {
    const payload = reactFlowToApi(nodes, edges, graphVersion);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${definitionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON exported');
  }, [nodes, edges, graphVersion, definitionId]);

  const hasStart = nodes.some((n) => asStep(n.data).nodeType === 'start');

  if (isLoading) {
    return (
      <div className="flex h-[700px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-500">Loading workflow...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-120px)] min-h-[600px] rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 overflow-hidden shadow-xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_, node) => { setSelectedNode(node); setSelectedEdge(null); }}
        onEdgeClick={(_, edge) => { setSelectedEdge(edge); setSelectedNode(null); }}
        onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
          style: { stroke: '#6b7280', strokeWidth: 2 },
        }}
        deleteKeyCode={null}
        className="bg-gray-50 dark:bg-gray-950"
      >
        <Background gap={20} size={1} color="#e5e7eb" className="dark:opacity-20" />
        <Controls
          showInteractive={false}
          className="!bg-white !border-gray-200 !shadow-lg dark:!bg-gray-900 dark:!border-gray-700 !rounded-lg"
        />
        <MiniMap
          nodeColor={(n) => {
            const kind = n.type;
            if (kind === 'start') return '#22c55e';
            if (kind === 'end') return '#ef4444';
            if (kind === 'decision') return '#f59e0b';
            if (kind === 'fork') return '#8b5cf6';
            if (kind === 'join') return '#6366f1';
            if (kind === 'notification') return '#ec4899';
            return '#3b82f6';
          }}
          className="!bg-white/90 !border-gray-200 dark:!bg-gray-900/90 dark:!border-gray-700 !rounded-lg"
          maskColor="rgba(0,0,0,0.08)"
        />

        {/* ── Top Toolbar ── */}
        <Panel position="top-center">
          <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
            <GitBranch className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Workflow Designer</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 font-mono">v{graphVersion}</span>

            <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Undo/Redo */}
            <button onClick={undo} disabled={historyIdx <= 0} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition" title="Undo (Ctrl+Z)">
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={redo} disabled={historyIdx >= history.length - 1} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition" title="Redo (Ctrl+Y)">
              <Redo2 className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Layout & Zoom */}
            <button onClick={handleAutoLayout} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Auto Layout">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 })} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Fit View">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleExportJSON} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Export JSON">
              <Download className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Node count */}
            <span className="text-[10px] text-gray-400">
              {nodes.length} nodes · {edges.length} edges
            </span>

            <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Save & Close */}
            <button
              onClick={handleSave}
              disabled={saveMut.isPending || validationErrors.length > 0}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                validationErrors.length > 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
              )}
              title={validationErrors.length > 0 ? `Fix ${validationErrors.length} issue(s) first` : 'Save workflow'}
            >
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition"
            >
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </Panel>

        {/* ── Left: Toolbox ── */}
        <Panel position="top-left">
          <ToolboxPanel hasStart={hasStart} />
        </Panel>

        {/* ── Right: Properties ── */}
        <Panel position="top-right">
          <PropertiesPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
            onDuplicate={handleDuplicate}
            onClose={() => { setSelectedNode(null); setSelectedEdge(null); }}
          />
        </Panel>

        {/* ── Bottom: Validation ── */}
        <Panel position="bottom-left">
          <ValidationPanel errors={validationErrors} />
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// EXPORT (with ReactFlowProvider wrapper)
// ══════════════════════════════════════════════════════════

interface WorkflowDesignerProps {
  definitionId: string;
  onClose: () => void;
}

export default function WorkflowDesigner({ definitionId, onClose }: WorkflowDesignerProps) {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerInner definitionId={definitionId} onClose={onClose} />
    </ReactFlowProvider>
  );
}
