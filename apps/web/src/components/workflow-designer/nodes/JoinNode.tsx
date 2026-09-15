'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { Merge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asStep, mlDisplay } from '../types';

export function JoinNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-lg border-2 shadow-lg transition-all duration-200',
      'h-[44px] w-[120px]',
      selected ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-2 scale-110' : 'border-indigo-400 hover:border-indigo-500',
      'bg-gradient-to-r from-indigo-50 via-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40',
    )}>
      <Merge className="h-4 w-4 text-indigo-600" />
      <span className="text-[8px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{mlDisplay(d.name, 'Join')}</span>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
      <Handle type="target" position={Position.Right} id="right-tgt" className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
    </div>
  );
}
