'use client';

import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

interface RealtimeState {
  connectionStatus: ConnectionStatus;
  liveOutbreakCount: number | null;
  toasts: ToastNotification[];
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLiveOutbreakCount: (count: number) => void;
  incrementOutbreakCount: () => void;
  addToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastCounter = 0;

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionStatus: 'disconnected',
  liveOutbreakCount: null,
  toasts: [],

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLiveOutbreakCount: (count) => set({ liveOutbreakCount: count }),

  incrementOutbreakCount: () =>
    set((state) => ({
      liveOutbreakCount:
        state.liveOutbreakCount !== null
          ? state.liveOutbreakCount + 1
          : null,
    })),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-4), // Keep max 5
        { ...toast, id, timestamp: new Date() },
      ],
    }));

    // Auto-remove after 6s
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 6000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),
}));
