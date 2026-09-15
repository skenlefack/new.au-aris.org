'use client';

import React, { useCallback, useState, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { NodeKind } from '../types';
import { NODE_CATALOG } from '../constants';

export function ToolboxPanel({ hasStart }: { hasStart: boolean }) {
  const t = useTranslations('workflow');
  const [collapsed, setCollapsed] = useState(false);

  const onDragStart = useCallback((e: DragEvent, nodeType: NodeKind) => {
    e.dataTransfer.setData('application/reactflow-type', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 w-[180px]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
      >
        <span>{t('designer.toolbox')}</span>
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-0.5">
          {NODE_CATALOG.map((item) => {
            const disabled = item.type === 'start' && hasStart;
            const label = t(`designer.${item.i18nKey}`);
            return (
              <div
                key={item.type}
                draggable={!disabled}
                onDragStart={(e) => onDragStart(e, item.type)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all cursor-grab active:cursor-grabbing',
                  disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-sm',
                  item.color,
                )}
                title={disabled ? t('designer.onlyOneStart') : t('designer.dragToAdd', { type: label })}
              >
                <GripVertical className="h-3 w-3 text-gray-300 shrink-0" />
                {item.icon}
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{label}</div>
                  <div className="text-[9px] text-gray-400 leading-tight">{t(`designer.${item.descKey}`)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
