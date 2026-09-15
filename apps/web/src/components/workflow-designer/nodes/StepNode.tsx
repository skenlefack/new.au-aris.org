'use client';

import React from 'react';
import { Position, Handle, type NodeProps } from '@xyflow/react';
import { Pencil, ShieldCheck, ArrowRightLeft, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asStep, mlDisplay, mlSecondary } from '../types';
import { LEVEL_CONFIG } from '../constants';

export function StepNode({ data, selected }: NodeProps) {
  const d = asStep(data);
  const level = LEVEL_CONFIG[d.levelType];
  const borderColor = level?.border ?? 'border-gray-300';
  const bgColor = level?.bg ?? 'bg-white';
  const darkBgColor = level?.darkBg ?? 'dark:bg-gray-800';
  const hasRoles = d.allowedRoles?.length > 0;
  const hasSLA = d.slaHours || d.transmitDelayHours;

  return (
    <div className={cn(
      'group relative rounded-xl border-2 shadow-lg transition-all duration-200 min-w-[200px] max-w-[260px]',
      borderColor, bgColor, darkBgColor,
      selected ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.03] shadow-xl' : 'hover:shadow-xl hover:scale-[1.01]',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3.5 !h-3.5 !border-2 !border-white !-top-[7px]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white !-left-[6px]" />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight">{mlDisplay(d.name, 'Untitled')}</div>
            {mlSecondary(d.name) && (
              <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{mlSecondary(d.name)}</div>
            )}
          </div>
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider', level?.bg, level?.color)}>
            {level?.i18nKey ?? d.levelType}
          </span>
        </div>
        {mlDisplay(d.description) && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 line-clamp-2 leading-snug">{mlDisplay(d.description)}</p>
        )}
      </div>

      {/* Footer badges */}
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
        {d.canEdit && (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[8px] font-medium text-blue-700 dark:text-blue-300">
            <Pencil className="h-2.5 w-2.5" /> Edit
          </span>
        )}
        {d.canValidate && (
          <span className="inline-flex items-center gap-0.5 rounded bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[8px] font-medium text-green-700 dark:text-green-300">
            <ShieldCheck className="h-2.5 w-2.5" /> Validate
          </span>
        )}
        {d.mergeStrategy === 'ANY' && (
          <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-[8px] font-medium text-orange-700 dark:text-orange-300">
            <ArrowRightLeft className="h-2.5 w-2.5" /> ANY
          </span>
        )}
        {hasRoles && (
          <span className="inline-flex items-center gap-0.5 rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-[8px] font-medium text-violet-700 dark:text-violet-300">
            <Users className="h-2.5 w-2.5" /> {d.allowedRoles.length}
          </span>
        )}
        {hasSLA && (
          <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[8px] font-medium text-gray-600 dark:text-gray-300">
            <Clock className="h-2.5 w-2.5" /> {d.slaHours ?? d.transmitDelayHours}h
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3.5 !h-3.5 !border-2 !border-white !-bottom-[7px]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white !-right-[6px]" />
    </div>
  );
}
