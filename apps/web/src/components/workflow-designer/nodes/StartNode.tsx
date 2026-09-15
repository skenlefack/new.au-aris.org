'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StartNode({ data, selected }: NodeProps) {
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-200',
      'h-[72px] w-[72px]',
      selected ? 'border-green-500 ring-2 ring-green-300 ring-offset-2 scale-110' : 'border-green-400 hover:border-green-500 hover:shadow-xl',
      'bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40',
    )}>
      <Play className="h-6 w-6 text-green-600 drop-shadow-sm" />
      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">Start</span>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
    </div>
  );
}
