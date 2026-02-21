'use client';

import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('aris-theme') as ThemeMode) ?? 'system';
}

function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  localStorage.setItem('aris-theme', mode);
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    applyTheme(mode);
    set({ mode });
  },
}));

// Listen for system theme changes when mode is 'system'
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.mode === 'system') {
      applyTheme('system');
    }
  });
}
