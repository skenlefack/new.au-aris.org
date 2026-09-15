'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
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
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  GitBranch,
  Save,
  X,
  Loader2,
  Undo2,
  Redo2,
  LayoutGrid,
  Download,
  Maximize2,
  CircleDot,
  Layers,
  Clock,
  LayoutTemplate,
  BookmarkPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowGraph, useSaveWorkflowGraph } from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { toast } from 'sonner';

import type { NodeKind, StepData, EdgeData } from './types';
import { asStep, asEdge, mlDisplay } from './types';
import { EDGE_STYLES, NODE_CATALOG } from './constants';
import { nodeTypes } from './nodes';
import { apiToReactFlow, reactFlowToApi } from './utils/serialization';
import { validateGraph } from './utils/validation';
import { autoLayout } from './utils/auto-layout';
import { getSimNodeClass, getSimEdgeStyle } from './utils/sim-helpers';
import { useTokenSimulation } from './hooks/useTokenSimulation';
import { ToolboxPanel } from './panels/ToolboxPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { ValidationPanel } from './panels/ValidationPanel';
import { SimulationPanel } from './panels/SimulationPanel';
import { SimulationResults } from './panels/SimulationResults';
import { VersionHistoryPanel } from './panels/VersionHistoryPanel';
import { VersionDiffView } from './panels/VersionDiffView';
import { TemplateLibrary } from './panels/TemplateLibrary';
import { SaveAsTemplate } from './panels/SaveAsTemplate';
import { GROUP_COLORS } from './nodes/GroupNode';

// ══════════════════════════════════════════════════════════
// MAIN DESIGNER (inner component, needs ReactFlowProvider)
// ══════════════════════════════════════════════════════════

interface WorkflowDesignerInnerProps {
  definitionId: string;
  onClose: () => void;
}

function WorkflowDesignerInner({ definitionId, onClose }: WorkflowDesignerInnerProps) {
  const t = useTranslations('workflow');
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

  // Feature panels state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ a: number; b: number } | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

  // Undo/Redo
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
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
      data: { edgeType: 'SEQUENTIAL' } as unknown as Record<string, unknown>,
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
      toast.error(t('designer.onlyOneStart'));
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
        name: { en: t(`designer.${catalog.i18nKey}`) },
        description: {},
        nodeType: type,
        levelType: type === 'step' || type === 'decision' ? 'NATIONAL_TECHNICAL' : type,
        canEdit: false,
        canValidate: type === 'step',
        allowedRoles: [],
        mergeStrategy: type === 'join' ? 'ALL' as const : 'ALL' as const,
        transmitDelayHours: null,
        slaHours: null,
        color: '',
      } as unknown as Record<string, unknown>,
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
        label: mlDisplay(newData.label) || (edgeType !== 'SEQUENTIAL' ? t(`designer.${style.i18nKey}`) : undefined),
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
        name: { ...d.name, en: `${mlDisplay(d.name)} (copy)` },
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  }, [nodes, setNodes]);

  // ── Groups ──
  const handleGroupSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected && n.type !== 'group');
    if (selectedNodes.length < 2) {
      toast.error('Select at least 2 nodes to group');
      return;
    }
    const idx = ++nodeCounter.current;
    const groupKey = `GROUP_${idx}`;
    const xs = selectedNodes.map((n) => n.position.x);
    const ys = selectedNodes.map((n) => n.position.y);
    const minX = Math.min(...xs) - 30;
    const minY = Math.min(...ys) - 50;
    const maxX = Math.max(...xs) + 260;
    const maxY = Math.max(...ys) + 120;

    const groupNode: Node = {
      id: `group-${groupKey}`,
      type: 'group',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: {
        groupKey,
        name: { en: `Group ${idx}` },
        description: {},
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
        isCollapsed: false,
        memberNodeIds: selectedNodes.map((n) => n.id),
        nodeType: 'group',
      },
    };

    setNodes((nds) => [
      groupNode,
      ...nds.map((n) => {
        if (selectedNodes.find((sn) => sn.id === n.id)) {
          return {
            ...n,
            parentId: `group-${groupKey}`,
            extent: 'parent' as const,
            position: { x: n.position.x - minX, y: n.position.y - minY },
          };
        }
        return n;
      }),
    ]);
  }, [nodes, setNodes]);

  const handleUngroup = useCallback((groupId: string) => {
    const groupNode = nodes.find((n) => n.id === groupId);
    if (!groupNode) return;
    setNodes((nds) => {
      const updated = nds
        .filter((n) => n.id !== groupId)
        .map((n) => {
          if (n.parentId === groupId) {
            return {
              ...n,
              parentId: undefined,
              extent: undefined,
              position: {
                x: n.position.x + groupNode.position.x,
                y: n.position.y + groupNode.position.y,
              },
            };
          }
          return n;
        });
      return updated;
    });
  }, [nodes, setNodes]);

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 }), 50);
    toast.success(t('designer.layoutApplied'));
  }, [nodes, edges, setNodes, reactFlowInstance]);

  const handleSave = useCallback(async () => {
    const errs = validateGraph(nodes, edges);
    if (errs.length > 0) {
      toast.error(t('designer.cannotSave', { count: String(errs.length) }), { description: errs[0] });
      return;
    }
    const payload = reactFlowToApi(nodes, edges, graphVersion);
    try {
      await saveMut.mutateAsync({ definitionId, ...payload });
      toast.success(t('designer.graphSaved'));
    } catch (err: any) {
      toast.error(t('designer.saveFailed'), { description: err?.message });
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
    toast.success(t('designer.jsonExported'));
  }, [nodes, edges, graphVersion, definitionId]);

  // ── Token Simulation ──
  const { sim, play: simPlay, pause: simPause, stepOnce: simStep, reset: simReset, setSpeed: simSetSpeed } = useTokenSimulation(nodes, edges);

  // Apply simulation visual styles to nodes
  useEffect(() => {
    if (sim.status === 'idle') return;
    setNodes((nds) => nds.map((n) => ({
      ...n,
      className: getSimNodeClass(n.id, sim),
    })));
  }, [sim.activeNodes, sim.visitedNodes, sim.status, setNodes]);

  // Apply simulation visual styles to edges
  useEffect(() => {
    if (sim.status === 'idle') return;
    setEdges((eds) => eds.map((e) => ({
      ...e,
      style: { ...e.style, ...getSimEdgeStyle(e.id, sim) },
      animated: sim.activeEdges.has(e.id) || (asEdge(e.data)?.edgeType === 'PARALLEL'),
    })));
  }, [sim.activeEdges, sim.visitedEdges, sim.status, setEdges]);

  // Reset edge/node styles when simulation ends or resets
  useEffect(() => {
    if (sim.status !== 'idle') return;
    setNodes((nds) => nds.map((n) => ({ ...n, className: undefined })));
    setEdges((eds) => eds.map((e) => {
      const edgeType = asEdge(e.data)?.edgeType ?? 'SEQUENTIAL';
      const style = EDGE_STYLES[edgeType];
      return { ...e, style: { stroke: style.color, strokeWidth: 2, strokeDasharray: style.dash }, animated: style.animated };
    }));
  }, [sim.status, setNodes, setEdges]);

  const hasStart = nodes.some((n) => asStep(n.data).nodeType === 'start');

  if (isLoading) {
    return (
      <div className="flex h-[700px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-500">{t('designer.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-[600px] rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 overflow-hidden shadow-xl">
      {/* ══ TOP TOOLBAR (outside canvas, full width) ══ */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900 shrink-0 flex-wrap">
        {/* Left: title */}
        <GitBranch className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('designer.title')}</span>
        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 font-mono">v{graphVersion}</span>

        <div className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={historyIdx <= 0} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition" title={`${t('designer.undo')} (Ctrl+Z)`}>
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={redo} disabled={historyIdx >= history.length - 1} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition" title={`${t('designer.redo')} (Ctrl+Y)`}>
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Layout & Zoom & Export */}
        <button onClick={handleAutoLayout} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title={t('designer.autoLayout')}>
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 })} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title={t('designer.fitView')}>
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleExportJSON} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title={t('designer.exportJson')}>
          <Download className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Group */}
        <button
          onClick={handleGroupSelected}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition"
          title="Group selected nodes"
        >
          <Layers className="h-3.5 w-3.5" />
          Group
        </button>

        {/* History */}
        <button
          onClick={() => setShowVersionHistory(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition"
          title={t('designer.versionHistory') || 'Version History'}
        >
          <Clock className="h-3.5 w-3.5" />
          History
        </button>

        {/* Templates */}
        <button
          onClick={() => setShowTemplateLibrary(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition"
          title={t('designer.templateLibrary') || 'Template Library'}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
        </button>

        {/* Save as Template */}
        <button
          onClick={() => setShowSaveAsTemplate(true)}
          disabled={nodes.length === 0}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 disabled:opacity-30 transition"
          title={t('designer.saveAsTemplate') || 'Save as Template'}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Simulate */}
        {sim.status === 'idle' ? (
          <button
            onClick={simPlay}
            disabled={validationErrors.length > 0 || !hasStart}
            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/20 dark:text-emerald-400 transition"
            title="Simulate token flow"
          >
            <CircleDot className="h-3.5 w-3.5" />
            Simulate
          </button>
        ) : (
          <button
            onClick={simReset}
            className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
          >
            <X className="h-3.5 w-3.5" />
            Stop
          </button>
        )}

        <div className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Node count */}
        <span className="text-[10px] text-gray-400">
          {nodes.length} {t('designer.nodes')} · {edges.length} {t('designer.edges')}
        </span>

        {/* Right side: Save & Close */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saveMut.isPending || validationErrors.length > 0}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              validationErrors.length > 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
            )}
            title={validationErrors.length > 0 ? t('designer.fixIssuesFirst', { count: String(validationErrors.length) }) : t('designer.saveWorkflow')}
          >
            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('designer.save')}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition"
          >
            <X className="h-3.5 w-3.5" /> {t('designer.close')}
          </button>
        </div>
      </div>

      {/* ══ SIMULATION RESULTS (shown when finished) ══ */}
      {sim.status === 'finished' && (
        <SimulationResults sim={sim} nodes={nodes} onReset={simReset} />
      )}

      {/* ══ CANVAS ══ */}
      <div className="flex-1 relative">
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

          {/* ── Bottom Left: Validation ── */}
          <Panel position="bottom-left">
            <ValidationPanel errors={validationErrors} />
          </Panel>

          {/* ── Bottom Right: Simulation ── */}
          <Panel position="bottom-right">
            <SimulationPanel
              sim={sim}
              onPlay={simPlay}
              onPause={simPause}
              onStep={simStep}
              onReset={simReset}
              onSetSpeed={simSetSpeed}
            />
          </Panel>
        </ReactFlow>
      </div>

      {/* ══ VERSION HISTORY PANEL ══ */}
      {showVersionHistory && (
        <VersionHistoryPanel
          definitionId={definitionId}
          onClose={() => setShowVersionHistory(false)}
          onOpenDiff={(a, b) => {
            setShowVersionHistory(false);
            setDiffVersions({ a, b });
          }}
        />
      )}

      {/* ══ VERSION DIFF VIEW ══ */}
      {diffVersions && (
        <VersionDiffView
          definitionId={definitionId}
          versionA={diffVersions.a}
          versionB={diffVersions.b}
          onClose={() => setDiffVersions(null)}
          onChangeVersions={(a, b) => setDiffVersions({ a, b })}
        />
      )}

      {/* ══ TEMPLATE LIBRARY ══ */}
      {showTemplateLibrary && (
        <TemplateLibrary
          definitionId={definitionId}
          hasExistingGraph={nodes.length > 0}
          onClose={() => setShowTemplateLibrary(false)}
          onApplied={() => setShowTemplateLibrary(false)}
        />
      )}

      {/* ══ SAVE AS TEMPLATE ══ */}
      {showSaveAsTemplate && (
        <SaveAsTemplate
          definitionId={definitionId}
          onClose={() => setShowSaveAsTemplate(false)}
        />
      )}
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
