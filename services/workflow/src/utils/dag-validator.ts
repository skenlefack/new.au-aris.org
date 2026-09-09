/**
 * DAG Validator for ARIS Workflow Graphs.
 *
 * Pure function that validates a workflow graph is a valid DAG:
 * - No cycles
 * - Exactly one "start" node
 * - At least one "end" node
 * - All nodes reachable from start
 * - Every non-"end" node has at least one outgoing edge
 * - All edges from the same source share the same edge_type
 */

export interface ValidatorStep {
  id: string;
  nodeType: string; // 'start' | 'step' | 'end'
  stepKey?: string | null;
}

export interface ValidatorEdge {
  sourceStepId: string;
  targetStepId: string;
  edgeType: string; // 'SEQUENTIAL' | 'PARALLEL' | 'CHOICE_SINGLE' | 'CHOICE_MULTI'
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDAG(steps: ValidatorStep[], edges: ValidatorEdge[]): ValidationResult {
  const errors: string[] = [];
  const stepIds = new Set(steps.map((s) => s.id));

  // 1. Check for at least one start node
  const startNodes = steps.filter((s) => s.nodeType === 'start');
  if (startNodes.length === 0) {
    errors.push('Graph must have exactly one start node');
  } else if (startNodes.length > 1) {
    errors.push(`Graph has ${startNodes.length} start nodes — only one is allowed`);
  }

  // 2. Check for at least one end node
  const endNodes = steps.filter((s) => s.nodeType === 'end');
  if (endNodes.length === 0) {
    errors.push('Graph must have at least one end node');
  }

  // 3. Validate edge references
  for (const edge of edges) {
    if (!stepIds.has(edge.sourceStepId)) {
      errors.push(`Edge source step ${edge.sourceStepId} does not exist`);
    }
    if (!stepIds.has(edge.targetStepId)) {
      errors.push(`Edge target step ${edge.targetStepId} does not exist`);
    }
    if (edge.sourceStepId === edge.targetStepId) {
      errors.push(`Self-loop on step ${edge.sourceStepId}`);
    }
  }

  // 4. Every non-end node must have at least one outgoing edge
  const nodesWithOutgoing = new Set(edges.map((e) => e.sourceStepId));
  for (const step of steps) {
    if (step.nodeType !== 'end' && !nodesWithOutgoing.has(step.id)) {
      errors.push(`Step "${step.stepKey || step.id}" has no outgoing edges (dead end)`);
    }
  }

  // 5. Start node should not have incoming edges
  const startIds = new Set(startNodes.map((s) => s.id));
  for (const edge of edges) {
    if (startIds.has(edge.targetStepId)) {
      errors.push('Start node cannot have incoming edges');
      break;
    }
  }

  // 6. End nodes should not have outgoing edges
  const endIds = new Set(endNodes.map((s) => s.id));
  for (const edge of edges) {
    if (endIds.has(edge.sourceStepId)) {
      errors.push('End node cannot have outgoing edges');
      break;
    }
  }

  // 7. All edges from the same source should share the same edge_type
  const edgesBySource = new Map<string, Set<string>>();
  for (const edge of edges) {
    const types = edgesBySource.get(edge.sourceStepId) ?? new Set();
    types.add(edge.edgeType);
    edgesBySource.set(edge.sourceStepId, types);
  }
  for (const [stepId, types] of edgesBySource) {
    if (types.size > 1) {
      const step = steps.find((s) => s.id === stepId);
      errors.push(`Step "${step?.stepKey || stepId}" has mixed edge types: ${[...types].join(', ')}. All outgoing edges must be the same type.`);
    }
  }

  // 8. Cycle detection (topological sort via Kahn's algorithm)
  if (errors.length === 0) {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const s of steps) {
      inDegree.set(s.id, 0);
      adjacency.set(s.id, []);
    }
    for (const e of edges) {
      adjacency.get(e.sourceStepId)?.push(e.targetStepId);
      inDegree.set(e.targetStepId, (inDegree.get(e.targetStepId) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      visited++;
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    if (visited < steps.length) {
      errors.push(`Graph contains a cycle — ${steps.length - visited} nodes are part of circular dependencies`);
    }
  }

  // 9. Reachability from start node
  if (errors.length === 0 && startNodes.length === 1) {
    const adjacency = new Map<string, string[]>();
    for (const s of steps) adjacency.set(s.id, []);
    for (const e of edges) adjacency.get(e.sourceStepId)?.push(e.targetStepId);

    const reachable = new Set<string>();
    const stack = [startNodes[0].id];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        stack.push(neighbor);
      }
    }

    const unreachable = steps.filter((s) => !reachable.has(s.id));
    if (unreachable.length > 0) {
      errors.push(`${unreachable.length} node(s) unreachable from start: ${unreachable.map((s) => s.stepKey || s.id).join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
