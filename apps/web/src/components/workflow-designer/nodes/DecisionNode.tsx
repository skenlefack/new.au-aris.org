'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { Diamond } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asStep, mlDisplay } from '../types';

export function DecisionNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex items-center justify-center transition-all duration-200',
      selected ? 'scale-110' : 'hover:scale-105',
    )}>
      <div className={cn(
        'h-[72px] w-[72px] rotate-45 rounded-lg border-2 shadow-lg',
        selected ? 'border-amber-500 ring-2 ring-amber-300 ring-offset-2' : 'border-amber-400 hover:border-amber-500',
        'bg-gradient-to-br from-amber-50 via-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40',
      )} />
      <div className="absolute flex flex-col items-center">
        <Diamond className="h-5 w-5 text-amber-600" />
        <span className="mt-0.5 text-[8px] font-bold text-amber-700 dark:text-amber-300 max-w-[60px] truncate text-center">{mlDisplay(d.name, '?')}</span>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
    </div>
  );
}
