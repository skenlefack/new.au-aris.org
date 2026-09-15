import type React from 'react';
import type { SimState } from '../types';

// ── Node highlight overlay (applied via className) ──

export function getSimNodeClass(nodeId: string, sim: SimState): string {
  if (sim.status === 'idle') return '';
  if (sim.activeNodes.has(nodeId)) return 'ring-4 ring-blue-400 ring-offset-2 animate-pulse scale-110 z-50';
  if (sim.visitedNodes.has(nodeId)) return 'ring-2 ring-green-400 ring-offset-1 opacity-90';
  return 'opacity-40';
}

export function getSimEdgeStyle(edgeId: string, sim: SimState): React.CSSProperties | undefined {
  if (sim.status === 'idle') return undefined;
  if (sim.activeEdges.has(edgeId)) return { strokeWidth: 4, filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.5))' };
  if (sim.visitedEdges.has(edgeId)) return { strokeWidth: 3, opacity: 0.8 };
  return { opacity: 0.2 };
}
