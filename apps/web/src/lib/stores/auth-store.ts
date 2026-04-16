'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'CONTINENTAL_ADMIN'
  | 'REC_ADMIN'
  | 'NATIONAL_ADMIN'
  | 'DATA_STEWARD'
  | 'WAHIS_FOCAL_POINT'
  | 'ANALYST'
  | 'FIELD_AGENT'
  | 'KNOWLEDGE_MANAGER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: string[];  // effective role codes from permission system
  tenantId: string;
  tenantLevel?: string;
  avatarUrl?: string;
  locale?: string;
  /**
   * True when the user must change their password before they can access
   * the app. Set on admin-created accounts and when an admin resets a
   * password. The ForcePasswordChangeModal blocks the UI until this is
   * cleared via PUT /api/v1/credential/users/me/password.
   */
  mustChangePassword?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  updateToken: (accessToken: string) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  clearMustChangePassword: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      updateToken: (accessToken) => set({ accessToken }),
      updateTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearMustChangePassword: () =>
        set((state) =>
          state.user
            ? { user: { ...state.user, mustChangePassword: false } }
            : state,
        ),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'aris-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
