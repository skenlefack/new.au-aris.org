import type { Node, Edge } from '@xyflow/react';

// ══════════════════════════════════════════════════════════
// AUTO LAYOUT (Dagre-like simple algorithm)
// ══════════════════════════════════════════════════════════

export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
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
