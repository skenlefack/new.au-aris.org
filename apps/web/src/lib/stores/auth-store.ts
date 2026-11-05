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
  | 'KNOWLEDGE_MANAGER'
  | 'NATIONAL_LABORATORY'
  | 'REGIONAL_LABORATORY'
  | 'CONTINENTAL_LABORATORY'
  | 'PAID_ADMIN'
  | 'DECISION_MAKER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: string[];  // effective role codes from permission system
  tenantId: string;
  tenantLevel?: string;
  /** GeoEntity UUIDs restricting user to specific admin divisions (admin1/admin2/...) */
  adminDivisionIds?: string[];
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
      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
        // Mirror tokens to IndexedDB so Service Worker Background Sync can read them
        import('@/lib/offline/db').then(({ storeAuthTokens }) => {
          storeAuthTokens(accessToken, refreshToken).catch(() => {});
        }).catch(() => {});
      },
      updateToken: (accessToken) => {
        set({ accessToken });
        const rt = useAuthStore.getState().refreshToken;
        if (rt) {
          import('@/lib/offline/db').then(({ storeAuthTokens }) => {
            storeAuthTokens(accessToken, rt).catch(() => {});
          }).catch(() => {});
        }
      },
      updateTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        import('@/lib/offline/db').then(({ storeAuthTokens }) => {
          storeAuthTokens(accessToken, refreshToken).catch(() => {});
        }).catch(() => {});
      },
      clearMustChangePassword: () =>
        set((state) =>
          state.user
            ? { user: { ...state.user, mustChangePassword: false } }
            : state,
        ),
      logout: () => {
        // Clean up offline data for the user's tenant
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.tenantId) {
          import('@/lib/offline/db').then(({ clearTenantData }) => {
            clearTenantData(currentUser.tenantId).catch(() => {});
          }).catch(() => {});
        }
        // Clear auth tokens from IndexedDB (Service Worker won't sync after logout)
        import('@/lib/offline/db').then(({ clearAuthTokens }) => {
          clearAuthTokens().catch(() => {});
        }).catch(() => {});
        // Destroy encryption key from memory
        import('@/lib/offline/crypto').then(({ destroyEncryption }) => {
          destroyEncryption();
        }).catch(() => {});
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
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

/**
 * Adopt a newer session written to localStorage by another tab of the same
 * browser. Call this before logging out on an auth failure: when the user
 * logs in from tab B, the server revokes tab A's session (single-session
 * policy). Without this check tab A would log out and wipe tab B's fresh
 * tokens from the shared localStorage. Returns true if a session was adopted.
 */
export function adoptSessionFromOtherTab(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('aris-auth');
    const stored = raw ? JSON.parse(raw)?.state : null;
    const current = useAuthStore.getState();
    if (
      stored?.isAuthenticated &&
      stored.accessToken &&
      stored.refreshToken &&
      stored.refreshToken !== current.refreshToken
    ) {
      useAuthStore.setState({
        user: stored.user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        isAuthenticated: true,
      });
      return true;
    }
  } catch {
    /* ignore parse errors */
  }
  return false;
}

// Keep tabs in sync: when another tab logs in, refreshes or logs out,
// reload the session from localStorage so this tab uses the same tokens.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'aris-auth') void useAuthStore.persist.rehydrate();
  });
}
