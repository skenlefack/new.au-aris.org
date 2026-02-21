'use client';

import { create } from 'zustand';

interface UiState {
  searchOpen: boolean;
  shortcutsOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  searchOpen: false,
  shortcutsOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
}));
