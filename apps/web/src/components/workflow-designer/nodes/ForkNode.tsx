'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asStep, mlDisplay } from '../types';

export function ForkNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-lg border-2 shadow-lg transition-all duration-200',
      'h-[44px] w-[120px]',
      selected ? 'border-purple-500 ring-2 ring-purple-300 ring-offset-2 scale-110' : 'border-purple-400 hover:border-purple-500',
      'bg-gradient-to-r from-purple-50 via-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40',
    )}>
      <GitFork className="h-4 w-4 text-purple-600" />
      <span className="text-[8px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">{mlDisplay(d.name, 'Fork')}</span>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
      <Handle type="source" position={Position.Left} id="left-src" className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
    </div>
  );
}
