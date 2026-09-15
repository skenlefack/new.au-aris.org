'use client';

import React from 'react';
import type { Node } from '@xyflow/react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SimState } from '../types';
import { asStep, mlDisplay } from '../types';

export function SimulationResults({ sim, nodes, onReset }: { sim: SimState; nodes: Node[]; onReset: () => void }) {
  const totalNodes = nodes.length;
  const visitedCount = sim.visitedNodes.size;
  const visitedEdges = sim.visitedEdges.size;
  const coverage = totalNodes > 0 ? Math.round((visitedCount / totalNodes) * 100) : 0;
  const splits = sim.log.filter((l) => l.type === 'split').length;
  const endReached = sim.log.filter((l) => l.type === 'end').length;
  const duration = sim.log.length > 1
    ? ((sim.log[sim.log.length - 1].time - sim.log[0].time) / 1000).toFixed(1)
    : '0';

  // Identify unreached nodes
  const unreached = nodes.filter((n) => !sim.visitedNodes.has(n.id));

  return (
    <div className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-900/20 dark:via-green-900/20 dark:to-teal-900/20 dark:border-emerald-800 px-4 py-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Simulation Complete</h3>
        </div>
        <button
          onClick={onReset}
          className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition"
        >
          Close Results
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Coverage */}
        <div className="rounded-lg bg-white/80 dark:bg-gray-800/50 p-2.5 border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Coverage</div>
          <div className="flex items-end gap-1 mt-1">
            <span className={cn(
              'text-xl font-bold',
              coverage === 100 ? 'text-emerald-600' : coverage >= 70 ? 'text-amber-600' : 'text-red-600',
            )}>{coverage}%</span>
            <span className="text-[10px] text-gray-400 mb-0.5">{visitedCount}/{totalNodes}</span>
          </div>
          {/* Mini progress bar */}
          <div className="mt-1.5 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', coverage === 100 ? 'bg-emerald-500' : coverage >= 70 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${coverage}%` }} />
          </div>
        </div>

        {/* Edges traversed */}
        <div className="rounded-lg bg-white/80 dark:bg-gray-800/50 p-2.5 border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Edges Used</div>
          <div className="text-xl font-bold text-blue-600 mt-1">{visitedEdges}</div>
        </div>

        {/* Parallel splits */}
        <div className="rounded-lg bg-white/80 dark:bg-gray-800/50 p-2.5 border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Splits</div>
          <div className="text-xl font-bold text-purple-600 mt-1">{splits}</div>
        </div>

        {/* End points reached */}
        <div className="rounded-lg bg-white/80 dark:bg-gray-800/50 p-2.5 border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">End Points</div>
          <div className="text-xl font-bold text-red-500 mt-1">{endReached}</div>
        </div>

        {/* Steps count */}
        <div className="rounded-lg bg-white/80 dark:bg-gray-800/50 p-2.5 border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Steps</div>
          <div className="text-xl font-bold text-gray-700 dark:text-gray-300 mt-1">{sim.log.length}</div>
        </div>

        {/* Duration */}
        <div className="rounded-lg bg-white/80 dark:bg-gray-800/50 p-2.5 border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</div>
          <div className="text-xl font-bold text-gray-700 dark:text-gray-300 mt-1">{duration}s</div>
        </div>
      </div>

      {/* Unreached nodes warning */}
      {unreached.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Unreached nodes ({unreached.length}):</span>
            <span className="text-xs text-amber-700 dark:text-amber-400 ml-1">
              {unreached.map((n) => mlDisplay(asStep(n.data).name)).join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
