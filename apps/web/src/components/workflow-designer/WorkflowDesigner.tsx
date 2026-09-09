'use client';

import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  Square,
  CheckCircle2,
  GitBranch,
  Save,
  RotateCcw,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Settings2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowGraph, useSaveWorkflowGraph } from '@/lib/api/workflow-hooks';
import { toast } from 'sonner';

// ── Types ──

interface StepData {
  stepKey: string;
  label: string;
  labelFr: string;
  nodeType: 'start' | 'step' | 'end';
  levelType: string;
  canEdit: boolean;
  canValidate: boolean;
  allowedRoles: string[];
  mergeStrategy: 'ALL' | 'ANY';
  transmitDelayHours: number | null;
}

interface EdgeData {
  edgeType: 'SEQUENTIAL' | 'PARALLEL' | 'CHOICE_SINGLE' | 'CHOICE_MULTI';
  label?: string;
  labelFr?: string;
}

// ── Custom Nodes ──

function StartNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepData;
  return (
    <div className={cn(
      'flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-md transition-all',
      selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-400',
      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30',
    )}>
      <Play className="h-6 w-6 text-green-600" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}

function StepNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepData;
  const levelColors: Record<string, string> = {
    NATIONAL_TECHNICAL: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    NATIONAL_OFFICIAL: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
    REC_HARMONIZATION: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20',
    CONTINENTAL_PUBLICATION: 'border-red-400 bg-red-50 dark:bg-red-900/20',
    national: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    regional: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20',
    continental: 'border-red-400 bg-red-50 dark:bg-red-900/20',
  };
  const colors = levelColors[d.levelType] ?? 'border-gray-300 bg-white dark:bg-gray-800';

  return (
    <div className={cn(
      'rounded-xl border-2 px-4 py-3 shadow-md min-w-[180px] max-w-[220px] transition-all',
      colors,
      selected && 'ring-2 ring-blue-300',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{d.label}</div>
      {d.labelFr && d.labelFr !== d.label && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{d.labelFr}</div>
      )}
      <div className="mt-1 flex items-center gap-1">
        <span className="rounded bg-gray-200 dark:bg-gray-700 px-1 py-0.5 text-[9px] font-medium text-gray-600 dark:text-gray-400">
          {d.levelType}
        </span>
        {d.mergeStrategy === 'ANY' && (
          <span className="rounded bg-orange-100 px-1 py-0.5 text-[9px] font-medium text-orange-700">ANY</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />
    </div>
  );
}

function EndNode({ data, selected }: NodeProps) {
  return (
    <div className={cn(
      'flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-md transition-all',
      selected ? 'border-red-500 ring-2 ring-red-200' : 'border-red-400',
      'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30',
    )}>
      <Square className="h-5 w-5 text-red-600" />
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode as any,
  step: StepNode as any,
  end: EndNode as any,
};

// ── Edge styling ──

const EDGE_COLORS: Record<string, string> = {
  SEQUENTIAL: '#6b7280',
  PARALLEL: '#8b5cf6',
  CHOICE_SINGLE: '#f59e0b',
  CHOICE_MULTI: '#10b981',
};

const EDGE_DASH: Record<string, string> = {
  SEQUENTIAL: '0',
  PARALLEL: '0',
  CHOICE_SINGLE: '8 4',
  CHOICE_MULTI: '8 4',
};

// ── Serialization ──

function apiToReactFlow(graphData: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graphData.steps ?? []).map((s: any, i: number) => ({
    id: s.id ?? s.stepKey,
    type: s.nodeType === 'start' ? 'start' : s.nodeType === 'end' ? 'end' : 'step',
    position: { x: s.positionX ?? 300, y: s.positionY ?? i * 120 },
    data: {
      stepKey: s.stepKey,
      label: s.name?.en ?? s.stepKey,
      labelFr: s.name?.fr ?? '',
      nodeType: s.nodeType ?? 'step',
      levelType: s.levelType ?? s.stepKey,
      canEdit: s.canEdit ?? false,
      canValidate: s.canValidate ?? true,
      allowedRoles: s.allowedRoles ?? [],
      mergeStrategy: s.mergeStrategy ?? 'ALL',
      transmitDelayHours: s.transmitDelayHours ?? null,
    } as StepData,
  }));

  const edges: Edge[] = (graphData.edges ?? []).map((e: any) => {
    const edgeType = e.edgeType ?? 'SEQUENTIAL';
    return {
      id: e.id ?? `${e.sourceStepId}-${e.targetStepId}`,
      source: e.sourceStepId,
      target: e.targetStepId,
      label: e.label?.en ?? (edgeType !== 'SEQUENTIAL' ? edgeType : undefined),
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[edgeType] },
      style: { stroke: EDGE_COLORS[edgeType], strokeWidth: 2, strokeDasharray: EDGE_DASH[edgeType] },
      data: { edgeType, label: e.label?.en, labelFr: e.label?.fr } as EdgeData,
      animated: edgeType === 'PARALLEL',
    };
  });

  return { nodes, edges };
}

function reactFlowToApi(nodes: Node[], edges: Edge[], graphVersion: number) {
  const steps = nodes.map((n, i) => ({
    stepKey: (n.data as StepData).stepKey,
    stepOrder: i,
    nodeType: (n.data as StepData).nodeType,
    levelType: (n.data as StepData).levelType,
    name: { en: (n.data as StepData).label, fr: (n.data as StepData).labelFr || (n.data as StepData).label },
    canEdit: (n.data as StepData).canEdit,
    canValidate: (n.data as StepData).canValidate,
    allowedRoles: (n.data as StepData).allowedRoles?.length ? (n.data as StepData).allowedRoles : undefined,
    mergeStrategy: (n.data as StepData).mergeStrategy,
    transmitDelayHours: (n.data as StepData).transmitDelayHours,
    positionX: n.position.x,
    positionY: n.position.y,
  }));

  // Map node IDs to stepKeys for edges
  const idToKey = new Map(nodes.map((n) => [n.id, (n.data as StepData).stepKey]));

  const apiEdges = edges.map((e) => ({
    sourceStepKey: idToKey.get(e.source) ?? e.source,
    targetStepKey: idToKey.get(e.target) ?? e.target,
    edgeType: (e.data as EdgeData)?.edgeType ?? 'SEQUENTIAL',
    label: (e.data as EdgeData)?.label ? { en: (e.data as EdgeData).label, fr: (e.data as EdgeData).labelFr } : undefined,
    sortOrder: 0,
  }));

  return { graphVersion, steps, edges: apiEdges };
}

// ── Toolbox Panel ──

function ToolboxPanel({ onAddNode }: { onAddNode: (type: 'start' | 'step' | 'end') => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ajouter</p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onAddNode('start')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 transition"
        >
          <Play className="h-3.5 w-3.5" /> Start
        </button>
        <button
          onClick={() => onAddNode('step')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Step
        </button>
        <button
          onClick={() => onAddNode('end')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition"
        >
          <Square className="h-3.5 w-3.5" /> End
        </button>
      </div>
    </div>
  );
}

// ── Properties Panel ──

function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (id: string, data: Partial<StepData>) => void;
  onUpdateEdge: (id: string, data: Partial<EdgeData>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onClose: () => void;
}) {
  if (!selectedNode && !selectedEdge) return null;

  if (selectedEdge) {
    const d = (selectedEdge.data ?? {}) as EdgeData;
    return (
      <div className="w-72 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Edge</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Type</label>
            <select
              value={d.edgeType ?? 'SEQUENTIAL'}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { edgeType: e.target.value as EdgeData['edgeType'] })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="SEQUENTIAL">Sequential</option>
              <option value="PARALLEL">Parallel (fan-out)</option>
              <option value="CHOICE_SINGLE">Choice — Single</option>
              <option value="CHOICE_MULTI">Choice — Multiple</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Label (EN)</label>
            <input
              value={d.label ?? ''}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
              placeholder="e.g. Send to ECCAS"
            />
          </div>
          <button
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
          >
            <Trash2 className="h-3 w-3" /> Delete Edge
          </button>
        </div>
      </div>
    );
  }

  if (selectedNode) {
    const d = (selectedNode.data ?? {}) as StepData;
    return (
      <div className="w-72 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {d.nodeType === 'start' ? 'Start' : d.nodeType === 'end' ? 'End' : 'Step'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        {d.nodeType === 'step' && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Key</label>
              <input
                value={d.stepKey}
                onChange={(e) => onUpdateNode(selectedNode.id, { stepKey: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Name (EN)</label>
              <input
                value={d.label}
                onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Name (FR)</label>
              <input
                value={d.labelFr}
                onChange={(e) => onUpdateNode(selectedNode.id, { labelFr: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Level Type</label>
              <select
                value={d.levelType}
                onChange={(e) => onUpdateNode(selectedNode.id, { levelType: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="NATIONAL_TECHNICAL">National Technical</option>
                <option value="NATIONAL_OFFICIAL">National Official</option>
                <option value="REC_HARMONIZATION">REC Harmonization</option>
                <option value="CONTINENTAL_PUBLICATION">Continental Publication</option>
                <option value="national">National (generic)</option>
                <option value="regional">Regional (generic)</option>
                <option value="continental">Continental (generic)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Merge Strategy</label>
              <select
                value={d.mergeStrategy}
                onChange={(e) => onUpdateNode(selectedNode.id, { mergeStrategy: e.target.value as 'ALL' | 'ANY' })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="ALL">ALL — wait for all branches</option>
                <option value="ANY">ANY — first branch unlocks</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={d.canEdit}
                  onChange={(e) => onUpdateNode(selectedNode.id, { canEdit: e.target.checked })}
                  className="rounded"
                />
                Can Edit
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={d.canValidate}
                  onChange={(e) => onUpdateNode(selectedNode.id, { canValidate: e.target.checked })}
                  className="rounded"
                />
                Can Validate
              </label>
            </div>
          </div>
        )}
        {d.nodeType !== 'start' && (
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
          >
            <Trash2 className="h-3 w-3" /> Delete Node
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ── MAIN DESIGNER ──

interface WorkflowDesignerProps {
  definitionId: string;
  onClose: () => void;
}

export default function WorkflowDesigner({ definitionId, onClose }: WorkflowDesignerProps) {
  const { data: graphRes, isLoading } = useWorkflowGraph(definitionId);
  const saveMut = useSaveWorkflowGraph();

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
  const nodeCounter = useRef(graphData?.steps?.length ?? 0);

  // Sync when data loads
  React.useEffect(() => {
    if (initial.nodes.length > 0) {
      setNodes(initial.nodes);
      setEdges(initial.edges);
      nodeCounter.current = initial.nodes.length;
    }
  }, [initial]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      style: { stroke: '#6b7280', strokeWidth: 2 },
      data: { edgeType: 'SEQUENTIAL' } as EdgeData,
    }, eds));
  }, [setEdges]);

  const handleAddNode = useCallback((type: 'start' | 'step' | 'end') => {
    const idx = ++nodeCounter.current;
    const key = type === 'start' ? 'START' : type === 'end' ? `END_${idx}` : `STEP_${idx}`;
    const newNode: Node = {
      id: `new-${idx}`,
      type,
      position: { x: 300, y: idx * 120 },
      data: {
        stepKey: key,
        label: type === 'start' ? 'Start' : type === 'end' ? 'End' : `Step ${idx}`,
        labelFr: type === 'start' ? 'Debut' : type === 'end' ? 'Fin' : `Etape ${idx}`,
        nodeType: type,
        levelType: type === 'step' ? 'NATIONAL_TECHNICAL' : type,
        canEdit: false,
        canValidate: true,
        allowedRoles: [],
        mergeStrategy: 'ALL' as const,
        transmitDelayHours: null,
      } as StepData,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleUpdateNode = useCallback((id: string, partial: Partial<StepData>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...partial } } : n));
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...partial } } : prev);
  }, [setNodes]);

  const handleUpdateEdge = useCallback((id: string, partial: Partial<EdgeData>) => {
    setEdges((eds) => eds.map((e) => {
      if (e.id !== id) return e;
      const newData = { ...(e.data as EdgeData), ...partial };
      const edgeType = newData.edgeType ?? 'SEQUENTIAL';
      return {
        ...e,
        data: newData,
        label: newData.label || (edgeType !== 'SEQUENTIAL' ? edgeType : undefined),
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[edgeType] },
        style: { stroke: EDGE_COLORS[edgeType], strokeWidth: 2, strokeDasharray: EDGE_DASH[edgeType] },
        animated: edgeType === 'PARALLEL',
      };
    }));
    setSelectedEdge((prev) => prev?.id === id ? { ...prev, data: { ...(prev.data as EdgeData), ...partial } } : prev);
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

  const handleSave = useCallback(async () => {
    const payload = reactFlowToApi(nodes, edges, graphVersion);
    try {
      await saveMut.mutateAsync({ definitionId, ...payload });
      toast.success('Workflow graph saved');
    } catch (err: any) {
      toast.error('Failed to save', { description: err?.message ?? 'Check graph for errors' });
    }
  }, [nodes, edges, graphVersion, definitionId, saveMut]);

  if (isLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative h-[700px] rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => { setSelectedNode(node); setSelectedEdge(null); }}
        onEdgeClick={(_, edge) => { setSelectedEdge(edge); setSelectedNode(null); }}
        onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
          style: { stroke: '#6b7280', strokeWidth: 2 },
        }}
        className="bg-gray-50 dark:bg-gray-950"
      >
        <Background gap={20} size={1} color="#e5e7eb" />
        <Controls className="!bg-white !border-gray-200 !shadow-lg dark:!bg-gray-900 dark:!border-gray-700" />
        <MiniMap
          nodeColor={(n) => n.type === 'start' ? '#22c55e' : n.type === 'end' ? '#ef4444' : '#3b82f6'}
          className="!bg-white !border-gray-200 dark:!bg-gray-900 dark:!border-gray-700"
        />

        {/* Top toolbar */}
        <Panel position="top-center">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
            <GitBranch className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Workflow Designer</span>
            <span className="text-[10px] text-gray-400">v{graphVersion}</span>
            <div className="mx-2 h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition"
            >
              <X className="h-3 w-3" /> Close
            </button>
          </div>
        </Panel>

        {/* Left toolbox */}
        <Panel position="top-left">
          <ToolboxPanel onAddNode={handleAddNode} />
        </Panel>

        {/* Right properties */}
        <Panel position="top-right">
          <PropertiesPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
            onClose={() => { setSelectedNode(null); setSelectedEdge(null); }}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
