'use client';

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '@/lib/stores/theme-store';

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const MODE_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="h-5 w-5" />,
  dark: <Moon className="h-5 w-5" />,
  system: <Monitor className="h-5 w-5" />,
};

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const nextMode = MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length];

  return (
    <button
      onClick={() => setMode(nextMode)}
      className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      aria-label={`Theme: ${MODE_LABELS[mode]}. Click to switch to ${MODE_LABELS[nextMode]}.`}
      title={`${MODE_LABELS[mode]} — click to switch`}
    >
      {MODE_ICONS[mode]}
    </button>
  );
}
