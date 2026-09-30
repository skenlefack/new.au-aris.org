'use client';

import React, { useState } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, Ban, Pause, ArrowUpDown,
  ChevronDown, ChevronRight,
} from 'lucide-react';

interface Activity {
  id: string;
  code: string;
  name: Record<string, string>;
  status: string;
  ragStatus: string;
  completionPercent: number;
  responsibleUnit?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  output?: {
    code: string;
    name: Record<string, string>;
    component?: { code: string; name: Record<string, string> };
  };
  budgetLines?: Array<{ approvedAmount: number; executedAmount: number }>;
  milestones?: Array<{ id: string; name: Record<string, string>; status: string; dueDate: string }>;
  _count?: { evidence: number };
}

interface Props {
  activities: Activity[];
  loading: boolean;
  locale: string;
  onSelect?: (activity: Activity) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; text: string }> = {
  NOT_STARTED: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Not Started', bg: 'bg-gray-100', text: 'text-gray-600' },
  PLANNED: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Planned', bg: 'bg-blue-50', text: 'text-blue-600' },
  IN_PROGRESS: { icon: <ArrowUpDown className="h-3.5 w-3.5" />, label: 'In Progress', bg: 'bg-blue-50', text: 'text-blue-700' },
  COMPLETED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Completed', bg: 'bg-green-50', text: 'text-green-700' },
  DELAYED: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Delayed', bg: 'bg-red-50', text: 'text-red-700' },
  ON_HOLD: { icon: <Pause className="h-3.5 w-3.5" />, label: 'On Hold', bg: 'bg-amber-50', text: 'text-amber-700' },
  CANCELLED: { icon: <Ban className="h-3.5 w-3.5" />, label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-500' },
};

const RAG_COLORS: Record<string, string> = {
  GREEN: '#22c55e',
  AMBER: '#f59e0b',
  RED: '#ef4444',
  GREY: '#94a3b8',
};

function localName(name: Record<string, string> | string | undefined, locale: string): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return name[locale] || name.en || '';
}

export function ActivitiesTable({ activities, loading, locale, onSelect }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  const filtered = statusFilter
    ? activities.filter((a) => a.status === statusFilter)
    : activities;

  // Group by output
  const grouped = new Map<string, Activity[]>();
  for (const act of filtered) {
    const key = act.output?.code || 'Other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(act);
  }

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedGroups(next);
  };

  // Initialize all groups as expanded
  if (expandedGroups.size === 0 && grouped.size > 0) {
    setExpandedGroups(new Set(grouped.keys()));
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !statusFilter ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          All ({activities.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = activities.filter((a) => a.status === key).length;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : `${cfg.bg} ${cfg.text} hover:opacity-80`
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Grouped Activities */}
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([outputCode, acts]) => {
          const isExpanded = expandedGroups.has(outputCode);
          const outputName = acts[0]?.output?.name;
          const completedCount = acts.filter((a) => a.status === 'COMPLETED').length;

          return (
            <div key={outputCode} className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(outputCode)}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t-xl"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <span className="text-xs font-bold text-green-600">{outputCode}</span>
                  <span className="text-sm font-medium">{localName(outputName, locale)}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {completedCount}/{acts.length} completed
                </span>
              </button>

              {/* Activity rows */}
              {isExpanded && (
                <div className="border-t divide-y dark:border-gray-800 dark:divide-gray-800">
                  {acts.map((act) => {
                    const cfg = STATUS_CONFIG[act.status] || STATUS_CONFIG.NOT_STARTED;
                    const budget = act.budgetLines?.reduce((s, b) => ({
                      approved: s.approved + Number(b.approvedAmount),
                      executed: s.executed + Number(b.executedAmount),
                    }), { approved: 0, executed: 0 });

                    return (
                      <div
                        key={act.id}
                        onClick={() => onSelect?.(act)}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      >
                        {/* RAG dot */}
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: RAG_COLORS[act.ragStatus] || RAG_COLORS.GREY }}
                        />

                        {/* Code + Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400">{act.code}</span>
                            <span className="text-sm font-medium truncate">{localName(act.name, locale)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {act.responsibleUnit && (
                              <span className="text-[11px] text-gray-400">{act.responsibleUnit}</span>
                            )}
                            <span className="text-[11px] text-gray-400">
                              {new Date(act.plannedStartDate).toLocaleDateString()} — {new Date(act.plannedEndDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>

                        {/* Completion bar */}
                        <div className="w-24 flex-shrink-0">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">{act.completionPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-0.5">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${act.completionPercent}%`,
                                backgroundColor: RAG_COLORS[act.ragStatus] || '#94a3b8',
                              }}
                            />
                          </div>
                        </div>

                        {/* Budget */}
                        {budget && budget.approved > 0 && (
                          <div className="w-20 flex-shrink-0 text-right">
                            <div className="text-xs font-medium tabular-nums">
                              {budget.executed >= 1000 ? `${(budget.executed / 1000).toFixed(0)}K` : budget.executed}
                            </div>
                            <div className="text-[11px] text-gray-400 tabular-nums">
                              / {budget.approved >= 1000 ? `${(budget.approved / 1000).toFixed(0)}K` : budget.approved}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
