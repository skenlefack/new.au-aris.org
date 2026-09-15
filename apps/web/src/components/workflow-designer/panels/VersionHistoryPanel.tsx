'use client';

import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import { X, Clock, RotateCcw, GitCompare, Eye, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkflowVersions,
  useWorkflowVersion,
  useRestoreWorkflowVersion,
} from '@/lib/api/workflow-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { toast } from 'sonner';
import { nodeTypes } from '../nodes';
import { apiToReactFlow } from '../utils/serialization';

interface VersionHistoryPanelProps {
  definitionId: string;
  onClose: () => void;
  onOpenDiff: (a: number, b: number) => void;
}

export function VersionHistoryPanel({ definitionId, onClose, onOpenDiff }: VersionHistoryPanelProps) {
  const t = useTranslations('workflow');
  const { data: versionsRes, isLoading } = useWorkflowVersions(definitionId);
  const restoreMut = useRestoreWorkflowVersion();

  const versions = versionsRes?.data ?? [];

  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  const handleRestore = async (version: number) => {
    try {
      await restoreMut.mutateAsync({ definitionId, version });
      toast.success(t('designer.versionRestored') || `Version ${version} restored`);
      onClose();
    } catch (err: any) {
      toast.error(t('designer.restoreFailed') || 'Restore failed', { description: err?.message });
    }
  };

  const handleCompare = () => {
    if (compareA !== null && compareB !== null && compareA !== compareB) {
      onOpenDiff(Math.min(compareA, compareB), Math.max(compareA, compareB));
    }
  };

  const toggleCompareSelect = (v: number) => {
    if (compareA === v) { setCompareA(null); return; }
    if (compareB === v) { setCompareB(null); return; }
    if (compareA === null) { setCompareA(v); return; }
    if (compareB === null) { setCompareB(v); return; }
    // Both set, replace B
    setCompareB(v);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Clock className="h-4 w-4 text-blue-500" />
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">
          {t('designer.versionHistory') || 'Version History'}
        </h2>
        <span className="ml-auto text-xs text-gray-400">{versions.length} versions</span>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Compare toolbar */}
      {(compareA !== null || compareB !== null) && (
        <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 dark:border-blue-900 dark:bg-blue-950">
          <GitCompare className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs text-blue-700 dark:text-blue-300">
            {compareA !== null ? `v${compareA}` : '?'} vs {compareB !== null ? `v${compareB}` : '?'}
          </span>
          <button
            onClick={handleCompare}
            disabled={compareA === null || compareB === null || compareA === compareB}
            className="ml-auto rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Compare
          </button>
          <button
            onClick={() => { setCompareA(null); setCompareB(null); }}
            className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Clock className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">{t('designer.noVersions') || 'No saved versions yet'}</p>
            <p className="text-xs text-gray-400">{t('designer.noVersionsHint') || 'Versions are created automatically when you save'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {versions.map((v: any) => {
              const isSelected = compareA === v.versionNumber || compareB === v.versionNumber;
              return (
                <li
                  key={v.id}
                  className={cn(
                    'group px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer',
                    isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                  )}
                  onClick={() => toggleCompareSelect(v.versionNumber)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      v{v.versionNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate">
                        {v.changeSummary || (t('designer.graphSaved') || 'Graph saved')}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewVersion(v.versionNumber); }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
                        title={t('designer.preview') || 'Preview'}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(v.versionNumber); }}
                        disabled={restoreMut.isPending}
                        className="rounded p-1 text-gray-400 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30"
                        title={t('designer.restore') || 'Restore'}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                        {compareA === v.versionNumber ? 'A' : 'B'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Preview overlay */}
      {previewVersion !== null && (
        <VersionPreviewOverlay
          definitionId={definitionId}
          version={previewVersion}
          onClose={() => setPreviewVersion(null)}
          onRestore={() => handleRestore(previewVersion)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Version Preview — read-only mini ReactFlow canvas
// ══════════════════════════════════════════════════════════

function VersionPreviewOverlay({
  definitionId,
  version,
  onClose,
  onRestore,
}: {
  definitionId: string;
  version: number;
  onClose: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations('workflow');
  const { data: versionRes, isLoading } = useWorkflowVersion(definitionId, version);

  const { nodes, edges } = useMemo(() => {
    if (!versionRes?.data?.snapshot) return { nodes: [] as Node[], edges: [] as Edge[] };
    return apiToReactFlow(versionRes.data.snapshot);
  }, [versionRes]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <Eye className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('designer.preview') || 'Preview'} v{version}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onRestore}
            className="flex items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
          >
            <RotateCcw className="h-3 w-3" />
            {t('designer.restore') || 'Restore'}
          </button>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
              <MiniMap
                nodeColor={(n) => {
                  if (n.type === 'start') return '#22c55e';
                  if (n.type === 'end') return '#ef4444';
                  if (n.type === 'decision') return '#f59e0b';
                  if (n.type === 'fork') return '#8b5cf6';
                  if (n.type === 'join') return '#6366f1';
                  if (n.type === 'notification') return '#ec4899';
                  return '#3b82f6';
                }}
                className="!bg-white/90 !border-gray-200 dark:!bg-gray-900/90 dark:!border-gray-700 !rounded-lg"
              />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
