import type { Node, Edge } from '@xyflow/react';
import { asStep, asEdge, mlDisplay } from '../types';

// ══════════════════════════════════════════════════════════
// CLIENT-SIDE GRAPH VALIDATION
// ══════════════════════════════════════════════════════════

export function validateGraph(nodes: Node[], edges: Edge[]): string[] {
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
      if (d.nodeType === 'end' && !hasIncoming) errors.push(`END "${mlDisplay(d.name)}" has no incoming connection`);
      if (d.nodeType !== 'start' && d.nodeType !== 'end' && !hasIncoming && !hasOutgoing) {
        errors.push(`"${mlDisplay(d.name)}" is disconnected`);
      }
      if (d.nodeType !== 'end' && d.nodeType !== 'start' && !hasOutgoing) {
        errors.push(`"${mlDisplay(d.name)}" has no outgoing connection (dead end)`);
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
      const label = mlDisplay(asStep(node?.data)?.name) || sourceId;
      errors.push(`"${label}" has mixed edge types — all outgoing must be same type`);
    }
  }

  return errors;
}
