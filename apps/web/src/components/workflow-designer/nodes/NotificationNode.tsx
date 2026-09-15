'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asStep, mlDisplay } from '../types';

export function NotificationNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  return (
    <div className={cn(
      'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed shadow-lg transition-all duration-200',
      'h-[60px] w-[140px]',
      selected ? 'border-pink-500 ring-2 ring-pink-300 ring-offset-2 scale-110' : 'border-pink-400 hover:border-pink-500',
      'bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 dark:from-pink-900/30 dark:to-rose-900/30',
    )}>
      <Bell className="h-4 w-4 text-pink-600" />
      <span className="text-[8px] font-bold text-pink-700 dark:text-pink-300 max-w-[120px] truncate">{mlDisplay(d.name, 'Notify')}</span>
      <Handle type="target" position={Position.Top} className="!bg-pink-500 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="source" position={Position.Bottom} className="!bg-pink-500 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
    </div>
  );
}
