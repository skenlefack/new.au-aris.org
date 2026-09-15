'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { toast } from 'sonner';
import type { SimState, SimToken } from '../types';
import { asStep, asEdge, mlDisplay } from '../types';

export function useTokenSimulation(nodes: Node[], edges: Edge[]) {
  const [sim, setSim] = useState<SimState>({
    status: 'idle',
    tokens: [],
    visitedNodes: new Set(),
    activeNodes: new Set(),
    visitedEdges: new Set(),
    activeEdges: new Set(),
    speed: 1,
    log: [],
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const tokenCounter = useRef(0);

  const getOutgoingEdges = useCallback((nodeId: string) => {
    return edges.filter((e) => e.source === nodeId);
  }, [edges]);

  const getIncomingEdges = useCallback((nodeId: string) => {
    return edges.filter((e) => e.target === nodeId);
  }, [edges]);

  const addLog = useCallback((message: string, type: SimState['log'][0]['type'] = 'info') => {
    setSim((s) => ({ ...s, log: [...s.log.slice(-50), { time: Date.now(), message, type }] }));
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    tokenCounter.current = 0;
    setSim({
      status: 'idle',
      tokens: [],
      visitedNodes: new Set(),
      activeNodes: new Set(),
      visitedEdges: new Set(),
      activeEdges: new Set(),
      speed: sim.speed,
      log: [],
    });
  }, [sim.speed]);

  const advanceToken = useCallback((token: SimToken): SimToken[] => {
    const node = nodes.find((n) => n.id === token.nodeId);
    if (!node) return [];
    const d = asStep(node.data);
    const outEdges = getOutgoingEdges(token.nodeId);

    // End node — token dies
    if (d.nodeType === 'end' || outEdges.length === 0) return [];

    // Check edge type
    const edgeType = asEdge(outEdges[0]?.data)?.edgeType ?? 'SEQUENTIAL';

    if (edgeType === 'PARALLEL' || d.nodeType === 'fork') {
      // Fork: create one token per outgoing edge
      return outEdges.map((e) => ({
        id: `tok-${++tokenCounter.current}`,
        nodeId: e.target,
        progress: 0,
        edgeId: e.id,
        color: edgeType === 'PARALLEL' ? '#8b5cf6' : token.color,
      }));
    }

    if (edgeType === 'CHOICE_SINGLE' || edgeType === 'CHOICE_MULTI' || d.nodeType === 'decision') {
      // Decision: prompt user — for simulation, take first edge
      const chosen = outEdges[0];
      return [{
        id: `tok-${++tokenCounter.current}`,
        nodeId: chosen.target,
        progress: 0,
        edgeId: chosen.id,
        color: '#f59e0b',
      }];
    }

    // Sequential: advance to single target
    const edge = outEdges[0];
    return [{
      id: `tok-${++tokenCounter.current}`,
      nodeId: edge.target,
      progress: 0,
      edgeId: edge.id,
      color: token.color,
    }];
  }, [nodes, edges, getOutgoingEdges]);

  const tick = useCallback(() => {
    setSim((prev) => {
      if (prev.status !== 'playing' || prev.tokens.length === 0) {
        if (prev.status === 'playing' && prev.tokens.length === 0) {
          clearInterval(intervalRef.current);
          return { ...prev, status: 'finished', log: [...prev.log, { time: Date.now(), message: 'Simulation complete', type: 'end' as const }] };
        }
        return prev;
      }

      const newVisited = new Set(prev.visitedNodes);
      const newActive = new Set<string>();
      const newVisitedEdges = new Set(prev.visitedEdges);
      const newActiveEdges = new Set<string>();
      let newTokens: SimToken[] = [];
      const newLog = [...prev.log];

      for (const token of prev.tokens) {
        // Token is at a node — dwell briefly then advance
        if (token.progress >= 1 || token.progress === 0) {
          newVisited.add(token.nodeId);
          const node = nodes.find((n) => n.id === token.nodeId);
          const d = node ? asStep(node.data) : null;

          // Check if Join node — wait for all incoming tokens
          if (d?.nodeType === 'join' || d?.mergeStrategy === 'ALL') {
            const incoming = getIncomingEdges(token.nodeId);
            const arrivedCount = prev.tokens.filter((t) => t.nodeId === token.nodeId).length;
            if (incoming.length > 1 && arrivedCount < incoming.length) {
              // Wait — keep token in place
              newActive.add(token.nodeId);
              newTokens.push({ ...token, progress: 0 });
              continue;
            }
          }

          const nextTokens = advanceToken(token);
          if (nextTokens.length === 0) {
            // End node
            newVisited.add(token.nodeId);
            newLog.push({ time: Date.now(), message: `Token reached ${d?.nodeType === 'end' ? 'END' : mlDisplay(d?.name)}`, type: 'end' });
          } else if (nextTokens.length > 1) {
            newLog.push({ time: Date.now(), message: `Split into ${nextTokens.length} tokens at ${mlDisplay(d?.name)}`, type: 'split' });
          } else {
            if (token.edgeId) newVisitedEdges.add(token.edgeId);
          }

          for (const nt of nextTokens) {
            newActive.add(nt.nodeId);
            if (nt.edgeId) {
              newActiveEdges.add(nt.edgeId);
              newVisitedEdges.add(nt.edgeId);
            }
            newTokens.push(nt);
          }
        }
      }

      // Deduplicate tokens at same node
      const seen = new Map<string, SimToken>();
      for (const t of newTokens) {
        const existing = seen.get(t.nodeId);
        if (!existing) seen.set(t.nodeId, t);
      }
      newTokens = Array.from(seen.values());

      return {
        ...prev,
        tokens: newTokens,
        visitedNodes: newVisited,
        activeNodes: newActive,
        visitedEdges: newVisitedEdges,
        activeEdges: newActiveEdges,
        log: newLog.slice(-50),
      };
    });
  }, [nodes, advanceToken, getIncomingEdges]);

  const play = useCallback(() => {
    const startNode = nodes.find((n) => asStep(n.data).nodeType === 'start');
    if (!startNode) { toast.error('No START node found'); return; }

    setSim((prev) => {
      if (prev.status === 'paused') return { ...prev, status: 'playing' };
      // Fresh start
      tokenCounter.current = 0;
      return {
        ...prev,
        status: 'playing',
        tokens: [{ id: `tok-${++tokenCounter.current}`, nodeId: startNode.id, progress: 0, color: '#3b82f6' }],
        visitedNodes: new Set([startNode.id]),
        activeNodes: new Set([startNode.id]),
        visitedEdges: new Set(),
        activeEdges: new Set(),
        log: [{ time: Date.now(), message: 'Simulation started', type: 'info' }],
      };
    });

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1200 / sim.speed);
  }, [nodes, tick, sim.speed]);

  const pause = useCallback(() => {
    clearInterval(intervalRef.current);
    setSim((s) => ({ ...s, status: 'paused' }));
  }, []);

  const stepOnce = useCallback(() => {
    const startNode = nodes.find((n) => asStep(n.data).nodeType === 'start');
    if (sim.status === 'idle' && startNode) {
      tokenCounter.current = 0;
      setSim((prev) => ({
        ...prev,
        status: 'paused',
        tokens: [{ id: `tok-${++tokenCounter.current}`, nodeId: startNode.id, progress: 0, color: '#3b82f6' }],
        visitedNodes: new Set([startNode.id]),
        activeNodes: new Set([startNode.id]),
        visitedEdges: new Set(),
        activeEdges: new Set(),
        log: [{ time: Date.now(), message: 'Simulation started (step mode)', type: 'info' }],
      }));
    } else {
      tick();
    }
  }, [nodes, sim.status, tick]);

  const setSpeed = useCallback((speed: number) => {
    setSim((s) => ({ ...s, speed }));
    if (sim.status === 'playing') {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, 1200 / speed);
    }
  }, [sim.status, tick]);

  // Cleanup
  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { sim, play, pause, stepOnce, reset, setSpeed };
}
