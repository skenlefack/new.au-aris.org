'use client';

import React from 'react';
import { Play, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { SimState } from '../types';

export function SimulationPanel({
  sim, onPlay, onPause, onStep, onReset, onSetSpeed,
}: {
  sim: SimState;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
}) {
  const t = useTranslations('workflow');

  if (sim.status === 'idle') return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-white/95 shadow-xl backdrop-blur dark:border-blue-800 dark:bg-gray-900/95 w-[320px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-2.5 w-2.5 rounded-full animate-pulse',
            sim.status === 'playing' ? 'bg-green-500' : sim.status === 'paused' ? 'bg-amber-500' : 'bg-gray-400',
          )} />
          <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
            {sim.status === 'playing' ? 'Simulating...' : sim.status === 'paused' ? 'Paused' : 'Finished'}
          </span>
          <span className="text-[10px] text-blue-500 bg-blue-100 dark:bg-blue-800 rounded px-1.5 py-0.5">
            {sim.tokens.length} token{sim.tokens.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onReset} className="text-[10px] text-blue-600 hover:underline dark:text-blue-400">Reset</button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-blue-50 dark:border-blue-900">
        {sim.status === 'playing' ? (
          <button onClick={onPause} className="rounded-md bg-amber-100 p-1.5 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 transition" title="Pause">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          </button>
        ) : (
          <button onClick={onPlay} disabled={sim.status === 'finished'} className="rounded-md bg-green-100 p-1.5 text-green-700 hover:bg-green-200 disabled:opacity-40 dark:bg-green-900/30 dark:text-green-400 transition" title="Play">
            <Play className="h-4 w-4" />
          </button>
        )}
        <button onClick={onStep} disabled={sim.status === 'finished'} className="rounded-md bg-blue-100 p-1.5 text-blue-700 hover:bg-blue-200 disabled:opacity-40 dark:bg-blue-900/30 dark:text-blue-400 transition" title="Step">
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-blue-100 dark:bg-blue-800" />

        {/* Speed */}
        <div className="flex items-center gap-1">
          {[0.5, 1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[9px] font-bold transition',
                sim.speed === s
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="max-h-[150px] overflow-y-auto px-3 py-2 space-y-0.5">
        {sim.log.slice(-10).reverse().map((entry, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            <span className={cn(
              'mt-0.5 h-1.5 w-1.5 rounded-full shrink-0',
              entry.type === 'move' ? 'bg-blue-400' :
              entry.type === 'split' ? 'bg-purple-400' :
              entry.type === 'merge' ? 'bg-indigo-400' :
              entry.type === 'end' ? 'bg-red-400' : 'bg-gray-300',
            )} />
            <span className="text-gray-600 dark:text-gray-400">{entry.message}</span>
          </div>
        ))}
        {sim.log.length === 0 && (
          <p className="text-[10px] text-gray-400 italic">Press Play to start simulation</p>
        )}
      </div>
    </div>
  );
}
