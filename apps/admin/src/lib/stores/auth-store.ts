'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminRole = 'SUPER_ADMIN' | 'CONTINENTAL_ADMIN';

const ALLOWED_ROLES: readonly string[] = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN'];

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  tenantId: string;
}

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AdminUser, accessToken: string, refreshToken: string) => void;
  updateToken: (accessToken: string) => void;
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
        if (!ALLOWED_ROLES.includes(user.role)) {
          throw new Error('Access denied: insufficient privileges for admin panel');
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      updateToken: (accessToken) => set({ accessToken }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'aris-admin-auth' },
  ),
);
