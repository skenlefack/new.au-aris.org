'use client';

import React, { useCallback } from 'react';
import {
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Multilingual display helper */
function mlDisplay(ml: Record<string, string> | undefined, fallback = ''): string {
  if (!ml) return fallback;
  return ml.en || ml.fr || ml.pt || Object.values(ml).find(Boolean) || fallback;
}

export interface GroupData {
  groupKey: string;
  name: Record<string, string>;
  description: Record<string, string>;
  color: string;
  isCollapsed: boolean;
  memberNodeIds: string[];
  nodeType: 'group';
}

function asGroup(data: unknown): GroupData {
  return data as GroupData;
}

const GROUP_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

/**
 * GroupNode renders as:
 * - Expanded: large dashed-border rectangle with title bar; child nodes use parentId
 * - Collapsed: compact rectangle with group name and member count badge
 */
function GroupNode({ data, selected }: NodeProps) {
  const d = asGroup(data);
  const memberCount = d.memberNodeIds?.length ?? 0;
  const color = d.color || '#6366f1';

  if (d.isCollapsed) {
    // Collapsed view: compact single rectangle
    return (
      <div
        className={cn(
          'relative rounded-xl border-2 shadow-lg transition-all duration-200 min-w-[160px]',
          selected
            ? 'ring-2 ring-offset-2 scale-[1.03] shadow-xl'
            : 'hover:shadow-xl hover:scale-[1.01]',
        )}
        style={{
          borderColor: color,
          borderStyle: 'dashed',
          backgroundColor: `${color}10`,
          ...(selected ? { ringColor: color } : {}),
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]"
          style={{ backgroundColor: color }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-3 !h-3 !border-2 !border-white !-left-[6px]"
          style={{ backgroundColor: color }}
        />

        <div className="flex items-center gap-2 px-3 py-2.5">
          <div
            className="w-1 self-stretch rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <Layers className="h-4 w-4 shrink-0" style={{ color }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight truncate">
              {mlDisplay(d.name, 'Group')}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">
              Collapsed
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {memberCount}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]"
          style={{ backgroundColor: color }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-3 !h-3 !border-2 !border-white !-right-[6px]"
          style={{ backgroundColor: color }}
        />
      </div>
    );
  }

  // Expanded view: large dashed-border rectangle container
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all duration-200',
        selected
          ? 'ring-2 ring-offset-2 shadow-xl'
          : 'hover:shadow-lg',
      )}
      style={{
        borderColor: color,
        backgroundColor: `${color}08`,
        minWidth: 300,
        minHeight: 200,
        ...(selected ? { ringColor: color } : {}),
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: `${color}15` }}
      >
        <div
          className="w-1 h-5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <Layers className="h-3.5 w-3.5 shrink-0" style={{ color }} />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate flex-1">
          {mlDisplay(d.name, 'Group')}
        </span>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {memberCount}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      </div>

      {/* Body area where child nodes are positioned */}
      <div className="p-2" style={{ minHeight: 150 }} />
    </div>
  );
}

export default GroupNode;
export { GROUP_COLORS };
