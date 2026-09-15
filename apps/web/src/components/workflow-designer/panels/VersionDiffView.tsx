'use client';

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import { X, GitCompare, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkflowVersion,
  useWorkflowVersionDiff,
  useWorkflowVersions,
  useRestoreWorkflowVersion,
} from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { toast } from 'sonner';
import { nodeTypes } from '../nodes';
import { apiToReactFlow } from '../utils/serialization';

interface VersionDiffViewProps {
  definitionId: string;
  versionA: number;
  versionB: number;
  onClose: () => void;
  onChangeVersions: (a: number, b: number) => void;
}

export function VersionDiffView({
  definitionId,
  versionA,
  versionB,
  onClose,
  onChangeVersions,
}: VersionDiffViewProps) {
  const t = useTranslations('workflow');
  const restoreMut = useRestoreWorkflowVersion();

  const { data: versionsRes } = useWorkflowVersions(definitionId);
  const { data: vResA, isLoading: loadA } = useWorkflowVersion(definitionId, versionA);
  const { data: vResB, isLoading: loadB } = useWorkflowVersion(definitionId, versionB);
  const { data: diffRes, isLoading: loadDiff } = useWorkflowVersionDiff(definitionId, versionA, versionB);

  const versions = versionsRes?.data ?? [];
  const diff = diffRes?.data;

  // Build sets for coloring nodes
  const addedStepKeys = useMemo(() => new Set((diff?.added?.steps ?? []).map((s: any) => s.stepKey)), [diff]);
  const removedStepKeys = useMemo(() => new Set((diff?.removed?.steps ?? []).map((s: any) => s.stepKey)), [diff]);
  const modifiedStepKeys = useMemo(() => new Set((diff?.modified?.steps ?? []).map((s: any) => s.stepKey)), [diff]);

  // Convert snapshots to ReactFlow nodes/edges with diff styling
  const flowA = useMemo(() => {
    if (!vResA?.data?.snapshot) return { nodes: [] as Node[], edges: [] as Edge[] };
    const { nodes, edges } = apiToReactFlow(vResA.data.snapshot);
    return {
      nodes: nodes.map((n) => {
        const stepKey = (n.data as any)?.stepKey;
        let className = '';
        if (removedStepKeys.has(stepKey)) className = 'ring-2 ring-red-500 ring-offset-2 rounded-lg';
        else if (modifiedStepKeys.has(stepKey)) className = 'ring-2 ring-amber-500 ring-offset-2 rounded-lg';
        return { ...n, className };
      }),
      edges,
    };
  }, [vResA, removedStepKeys, modifiedStepKeys]);

  const flowB = useMemo(() => {
    if (!vResB?.data?.snapshot) return { nodes: [] as Node[], edges: [] as Edge[] };
    const { nodes, edges } = apiToReactFlow(vResB.data.snapshot);
    return {
      nodes: nodes.map((n) => {
        const stepKey = (n.data as any)?.stepKey;
        let className = '';
        if (addedStepKeys.has(stepKey)) className = 'ring-2 ring-green-500 ring-offset-2 rounded-lg';
        else if (modifiedStepKeys.has(stepKey)) className = 'ring-2 ring-amber-500 ring-offset-2 rounded-lg';
        return { ...n, className };
      }),
      edges,
    };
  }, [vResB, addedStepKeys, modifiedStepKeys]);

  const handleRestore = useCallback(async (version: number) => {
    try {
      await restoreMut.mutateAsync({ definitionId, version });
      toast.success(`Version ${version} restored`);
      onClose();
    } catch (err: any) {
      toast.error('Restore failed', { description: err?.message });
    }
  }, [definitionId, restoreMut, onClose]);

  const isLoading = loadA || loadB || loadDiff;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900 shrink-0">
        <GitCompare className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          {t('designer.versionDiff') || 'Version Diff'}
        </span>

        {/* Version selectors */}
        <div className="flex items-center gap-1.5 ml-4">
          <VersionSelector
            label="A"
            value={versionA}
            versions={versions}
            onChange={(v) => onChangeVersions(v, versionB)}
          />
          <span className="text-xs text-gray-400">vs</span>
          <VersionSelector
            label="B"
            value={versionB}
            versions={versions}
            onChange={(v) => onChangeVersions(versionA, v)}
          />
        </div>

        {/* Summary */}
        {diff && (
          <div className="ml-4 flex items-center gap-2 text-[11px]">
            {diff.added.steps.length > 0 && (
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                +{diff.added.steps.length} added
              </span>
            )}
            {diff.removed.steps.length > 0 && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                -{diff.removed.steps.length} removed
              </span>
            )}
            {diff.modified.steps.length > 0 && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                ~{diff.modified.steps.length} modified
              </span>
            )}
          </div>
        )}

        {/* Right: restore + close */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => handleRestore(versionA)}
            disabled={restoreMut.isPending}
            className="flex items-center gap-1 rounded bg-amber-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> Restore v{versionA}
          </button>
          <button
            onClick={() => handleRestore(versionB)}
            disabled={restoreMut.isPending}
            className="flex items-center gap-1 rounded bg-blue-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> Restore v{versionB}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-green-500" /> Added
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-red-500" /> Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-amber-500" /> Modified
        </span>
      </div>

      {/* Side-by-side canvases */}
      <div className="flex-1 flex">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Left canvas (version A) */}
            <div className="flex-1 border-r border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 left-2 z-10 rounded bg-white/90 px-2 py-0.5 text-[11px] font-bold text-gray-600 shadow dark:bg-gray-900/90 dark:text-gray-400">
                v{versionA}
              </div>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={flowA.nodes}
                  edges={flowA.edges}
                  nodeTypes={nodeTypes}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag
                  zoomOnScroll
                  className="bg-gray-50 dark:bg-gray-950"
                >
                  <Background gap={20} size={1} color="#e5e7eb" className="dark:opacity-20" />
                  <Controls showInteractive={false} className="!bg-white !border-gray-200 dark:!bg-gray-900 dark:!border-gray-700 !rounded-lg" />
                </ReactFlow>
              </ReactFlowProvider>
            </div>

            {/* Right canvas (version B) */}
            <div className="flex-1 relative">
              <div className="absolute top-2 left-2 z-10 rounded bg-white/90 px-2 py-0.5 text-[11px] font-bold text-gray-600 shadow dark:bg-gray-900/90 dark:text-gray-400">
                v{versionB}
              </div>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={flowB.nodes}
                  edges={flowB.edges}
                  nodeTypes={nodeTypes}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag
                  zoomOnScroll
                  className="bg-gray-50 dark:bg-gray-950"
                >
                  <Background gap={20} size={1} color="#e5e7eb" className="dark:opacity-20" />
                  <Controls showInteractive={false} className="!bg-white !border-gray-200 dark:!bg-gray-900 dark:!border-gray-700 !rounded-lg" />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Version selector dropdown
// ──────────────────────────────────────────────────────────

function VersionSelector({
  label,
  value,
  versions,
  onChange,
}: {
  label: string;
  value: number;
  versions: any[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <span className="mr-1 text-[10px] font-bold text-gray-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="appearance-none rounded border border-gray-200 bg-white py-0.5 pl-2 pr-5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {versions.map((v: any) => (
          <option key={v.versionNumber} value={v.versionNumber}>
            v{v.versionNumber}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-gray-400" />
    </div>
  );
}
