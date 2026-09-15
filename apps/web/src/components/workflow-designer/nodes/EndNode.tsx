'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

export function EndNode({ data, selected }: NodeProps) {
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-200',
      'h-[72px] w-[72px]',
      selected ? 'border-red-500 ring-2 ring-red-300 ring-offset-2 scale-110' : 'border-red-400 hover:border-red-500 hover:shadow-xl',
      'bg-gradient-to-br from-red-50 via-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40',
    )}>
      <div className="h-6 w-6 rounded-full border-[3px] border-red-500 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-red-500" />
      </div>
      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">End</span>
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-red-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
    </div>
  );
}
