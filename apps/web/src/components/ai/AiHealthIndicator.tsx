'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useAiHealth } from '@/lib/api/ai-hooks';
import { useTranslations } from '@/lib/i18n/translations';

export function AiHealthIndicator() {
  const t = useTranslations('ai');
  const { data, isError } = useAiHealth();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const health = data?.data;
  const isOk = health?.status === 'ok';
  const isDegraded = health?.status === 'degraded';
  const isDown = isError || (!health && !isError) || health?.status === 'down';

  const dotColor = isOk
    ? 'bg-emerald-500'
    : isDegraded
    ? 'bg-amber-500'
    : 'bg-red-500';

  const statusText = isOk
    ? t('aiOnline')
    : isDegraded
    ? t('aiDegraded')
    : t('aiOffline');

  // Close tooltip on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setTooltipVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setTooltipVisible(!tooltipVisible)}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors duration-150"
        aria-label={`AI: ${statusText}`}
      >
        <Sparkles className="h-[18px] w-[18px]" style={{ color: '#C9A227' }} />
        {/* Status dot */}
        <span
          className={`absolute right-1 top-1 h-2 w-2 rounded-full ${dotColor} border border-white dark:border-gray-900`}
        />
      </button>

      {/* Tooltip */}
      {tooltipVisible && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-900 animate-scale-in">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {statusText}
            </span>
          </div>
          {health?.ollama && (
            <p className="mt-1.5 text-[10px] text-gray-400">
              Ollama: {health.ollama.connected ? 'Connected' : 'Disconnected'}
              {health.ollama.models && ` (${health.ollama.models.length} models)`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
